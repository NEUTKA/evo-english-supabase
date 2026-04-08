// supabase/functions/delete-account/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !ANON || !SRK) {
      return new Response(
        JSON.stringify({
          error: "Missing env vars",
          hasUrl: !!SUPABASE_URL,
          hasAnon: !!ANON,
          hasServiceRole: !!SRK,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) User client: validate token + get user id
    const userClient = createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) {
      return new Response(JSON.stringify({ error: "Invalid session", details: uErr?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = u.user.id;

    // 2) Admin client: privileged deletes + delete user
    const admin = createClient(SUPABASE_URL, SRK, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SRK}` } },
    });

    // ===== Delete user-related rows first (IMPORTANT ORDER) =====
    // cards -> modules (cards may reference modules via module_id)
    // telemetry_events independent
    let e: { message: string } | null = null;

    // cards
    ({ error: e } = await admin.from("cards").delete().eq("user_id", userId));
    if (e) {
      return new Response(JSON.stringify({ error: "Failed deleting cards", details: e.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // modules
    ({ error: e } = await admin.from("modules").delete().eq("user_id", userId));
    if (e) {
      return new Response(JSON.stringify({ error: "Failed deleting modules", details: e.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // telemetry_events (optional: delete полностью)
    ({ error: e } = await admin.from("telemetry_events").delete().eq("user_id", userId));
    if (e) {
      return new Response(
        JSON.stringify({ error: "Failed deleting telemetry_events", details: e.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ===== Finally delete auth user =====
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return new Response(JSON.stringify({ error: "Delete failed", details: delErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unhandled error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
