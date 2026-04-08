// supabase/functions/translate/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_KEY = Deno.env.get("GOOGLE_TRANSLATE_KEY")!;

const srv = createClient(SUPABASE_URL, SERVICE_KEY);
function userClient(req: Request) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

function ipOf(req: Request) {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    ""
  ).trim() || "0.0.0.0";
}
function guestKey(req: Request) {
  const ip = ipOf(req);
  const ua = req.headers.get("user-agent") || "";
  let h = 5381; for (let i = 0; i < ua.length; i++) h = ((h << 5) + h) + ua.charCodeAt(i);
  return `guest:${ip}:${(h >>> 0).toString(36)}`;
}

async function log(feature: string, req: Request, status: number, ms: number, meta: Record<string, unknown>, userId?: string) {
  try {
    await srv.rpc("log_event", {
      p_feature: feature,
      p_action: "request",
      p_status: status,
      p_user_id: userId ?? null,
      p_guest_key: userId ? null : guestKey(req),
      p_ip: ipOf(req),
      p_ua: req.headers.get("user-agent") || "",
      p_duration_ms: ms,
      p_meta: meta ?? {},
    });
  } catch { }
}

type LimitRow = { allowed: boolean; remaining: number; reset_at: string };
async function consumeGuestLimit(key: string, limit = 20, window = "24 hours"): Promise<LimitRow> {
  const { data, error } = await srv.rpc("consume_rate_limit", { p_key: key, p_limit: limit, p_window: window });
  if (error) throw error;
  return (data as any[])[0] as LimitRow;
}

const G_URL = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`;
const EXPOSE = "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Auth-Mode, Retry-After";

Deno.serve(async (req) => {
  const CORS = getCorsHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Запрет неизвестных источников
  if (!CORS.get("Access-Control-Allow-Origin")) {
    return new Response("Forbidden origin", { status: 403, headers: CORS });
  }

  const t0 = Date.now();
  let status = 200;
  let userId: string | undefined;
  let guestRow: LimitRow | null = null;

  // ?guest=1 — форсируем гостя даже при наличии токена
  const url = new URL(req.url);
  const forceGuest = url.searchParams.get("guest") === "1";

  try {
    const { q, target = "ru" } = await req.json();
    const text = (q ?? "").toString().trim();
    const lang = (target ?? "ru").toString().slice(0, 5);

    if (!text) {
      status = 400;
      const h = new Headers(CORS);
      h.set("Content-Type", "application/json");
      h.set("X-Auth-Mode", "guest");
      h.set("Access-Control-Expose-Headers", EXPOSE);
      return new Response(JSON.stringify({ error: "Empty text" }), { status, headers: h });
    }

    // авторизация
    const uc = userClient(req);
    const { data: auth } = await uc.auth.getUser();
    userId = forceGuest ? undefined : auth?.user?.id;

    // лимит для гостя
    if (!userId) {
      guestRow = await consumeGuestLimit(guestKey(req), 20, "24 hours");
      if (!guestRow?.allowed) {
        status = 429;
        const h = new Headers(CORS);
        h.set("Content-Type", "application/json");
        h.set("Cache-Control", "no-store");
        h.set("X-Auth-Mode", "guest");
        h.set("X-RateLimit-Limit", "20");
        h.set("X-RateLimit-Remaining", "0");
        h.set("X-RateLimit-Reset", guestRow?.reset_at ?? "");
        h.set("Access-Control-Expose-Headers", EXPOSE);

        // ⬇️ Retry-After: сколько секунд до сброса окна
        const resetISO = guestRow?.reset_at ?? "";
        let seconds = 60; // запасной вариант
        if (resetISO) {
          const ms = new Date(resetISO).getTime() - Date.now();
          if (ms > 0) seconds = Math.max(1, Math.ceil(ms / 1000));
        }
        h.set("Retry-After", String(seconds));

        return new Response(JSON.stringify({
          error: "free_limit_reached",
          message: "You have used 20 free translations today. Sign in to continue without limits.",
          reset_at: guestRow?.reset_at
        }), { status, headers: h });
      }
    }


    // запрос к Google
    const r = await fetch(G_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: lang, format: "text" })
    });
    const data = await r.json();

    if (!r.ok) {
      status = r.status;
      const h = new Headers(CORS);
      h.set("Content-Type", "application/json");
      h.set("Cache-Control", "no-store");
      h.set("X-Auth-Mode", userId ? "user" : "guest");
      h.set("Access-Control-Expose-Headers", EXPOSE);
      return new Response(JSON.stringify({ error: data?.error?.message ?? "Translate failed" }), { status, headers: h });
    }

    const translation = data?.data?.translations?.[0]?.translatedText ?? "";

    // ✅ SUCCESS: вернуть перевод + серверные лимиты для гостя
    const h = new Headers(CORS);
    h.set("Content-Type", "application/json");
    h.set("Cache-Control", "no-store");
    h.set("X-Auth-Mode", userId ? "user" : "guest");
    h.set("Access-Control-Expose-Headers", EXPOSE);

    if (!userId && guestRow) {
      h.set("X-RateLimit-Limit", "20");
      h.set("X-RateLimit-Remaining", String(guestRow.remaining));
      h.set("X-RateLimit-Reset", guestRow.reset_at);
    }

    status = 200;

    // тело ответа: перевод + счётчики для гостя
    const body: Record<string, unknown> = { translation };
    if (!userId && guestRow) {
      body.limit = 20;
      body.remaining = guestRow.remaining;
      body.reset_at = guestRow.reset_at;
    }

    return new Response(JSON.stringify(body), { status, headers: h });

  } catch (e: any) {
    // ❌ ERROR
    status = 500;
    const h = new Headers(CORS);
    h.set("Content-Type", "application/json");
    h.set("Cache-Control", "no-store");
    h.set("X-Auth-Mode", userId ? "user" : "guest");
    h.set("Access-Control-Expose-Headers", EXPOSE);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status, headers: h });
  } finally {
    await log("translate", req, status, Date.now() - t0, {}, userId);
  }

});
