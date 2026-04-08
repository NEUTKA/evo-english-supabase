// supabase/functions/languages/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const GOOGLE_KEY = Deno.env.get("GOOGLE_TRANSLATE_KEY")!;
const EXPOSE = "X-Cache, X-Auth-Mode";

const G_LANGS = `https://translation.googleapis.com/language/translate/v2/languages?key=${GOOGLE_KEY}&target=en`;

Deno.serve(async (req) => {
  const CORS = getCorsHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Block unknown origins (same pattern as translate)
  if (!CORS.get("Access-Control-Allow-Origin")) {
    return new Response("Forbidden origin", { status: 403, headers: CORS });
  }

  try {
    // optional: allow ?ui=en or ?ui=ru to localize language names (Google supports target=..)
    const url = new URL(req.url);
    const ui = (url.searchParams.get("ui") || "en").slice(0, 5);

    const r = await fetch(G_LANGS.replace("target=en", "target=" + encodeURIComponent(ui)), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const data = await r.json();

    if (!r.ok) {
      const h = new Headers(CORS);
      h.set("Content-Type", "application/json");
      h.set("Cache-Control", "no-store");
      h.set("X-Auth-Mode", "public");
      h.set("Access-Control-Expose-Headers", EXPOSE);
      return new Response(JSON.stringify({ error: data?.error?.message ?? "Languages fetch failed" }), { status: r.status, headers: h });
    }

    // Expected: data.data.languages = [{ language:"ru", name:"Russian" }, ...]
    const list = data?.data?.languages ?? [];

    const h = new Headers(CORS);
    h.set("Content-Type", "application/json");
    // cache on client side (and any CDN) for 24h
    h.set("Cache-Control", "public, max-age=86400");
    h.set("X-Cache", "max-age=86400");
    h.set("X-Auth-Mode", "public");
    h.set("Access-Control-Expose-Headers", EXPOSE);

    return new Response(JSON.stringify({ languages: list }), { status: 200, headers: h });
  } catch (e: any) {
    const h = new Headers(CORS);
    h.set("Content-Type", "application/json");
    h.set("Cache-Control", "no-store");
    h.set("X-Auth-Mode", "public");
    h.set("Access-Control-Expose-Headers", EXPOSE);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: h });
  }
});
