import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const EVO_CRON_SECRET = Deno.env.get("EVO_CRON_SECRET") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Evo-English <no-reply@evo-english.com>";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "evoenglish@outlook.com";
const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const READING_A1_URL = "https://www.evo-english.com/reading-a1";
const READING_A1_MARK = 101;
const LOGO_URL = "https://cdn.prod.website-files.com/67a07e06a921f402fbb0f302/69d3b9275423b805dd6487de_%D0%9B%D0%BE%D0%B3%D0%BE%D1%82%D0%B8%D0%BF%20Evo-English%20%D1%81%20%D1%81%D1%82%D0%B8%D0%BB%D0%B8%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D1%8B%D0%BC%20%D0%BC%D0%BE%D0%B7%D0%B3%D0%BE%D0%BC.png";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function htmlPage(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function pickNudge(days: number, continueUrl: string) {
  const safeUrl = continueUrl?.startsWith("http")
    ? continueUrl
    : "https://www.evo-english.com/personal-account";

  if (days >= 21) {
    return {
      subject: "21 days — you’re building a real habit 💪",
      html: `<div style="font-family:system-ui;-webkit-font-smoothing:antialiased;line-height:1.55">
        <h2 style="margin:0 0 10px">You’re so close to a strong routine</h2>
        <p>Try <b>20–30 minutes a day</b>. After about <b>21 days</b>, studying starts to feel natural.</p>
        <p style="margin:18px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">
            Continue learning →
          </a>
        </p>
      </div>`,
      text: `Try 20–30 minutes a day. Continue: ${safeUrl}`,
    };
  }

  if (days >= 9) {
    return {
      subject: "Day 9 — let’s get back on track 🚀",
      html: `<div style="font-family:system-ui;-webkit-font-smoothing:antialiased;line-height:1.55">
        <h2 style="margin:0 0 10px">Quick comeback?</h2>
        <p>Even <b>15–20 minutes today</b> is enough to restart your momentum.</p>
        <p style="margin:18px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">
            Continue learning →
          </a>
        </p>
      </div>`,
      text: `Even 15–20 minutes today helps. Continue: ${safeUrl}`,
    };
  }

  if (days >= 6) {
    return {
      subject: "A small routine beats motivation 🙂",
      html: `<div style="font-family:system-ui;-webkit-font-smoothing:antialiased;line-height:1.55">
        <h2 style="margin:0 0 10px">6 days — time for a tiny step</h2>
        <p>Make it easy: <b>20 minutes</b>, one lesson, done.</p>
        <p style="margin:18px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">
            Continue learning →
          </a>
        </p>
      </div>`,
      text: `Make it easy: 20 minutes. Continue: ${safeUrl}`,
    };
  }

  return {
    subject: "We saved your progress — ready to continue?",
    html: `<div style="font-family:system-ui;-webkit-font-smoothing:antialiased;line-height:1.55">
      <h2 style="margin:0 0 10px">Quick practice today?</h2>
      <p>Just <b>20 minutes</b> can keep your English moving forward.</p>
      <p style="margin:18px 0">
        <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">
          Continue learning →
        </a>
      </p>
    </div>`,
    text: `Quick practice today? Continue: ${safeUrl}`,
  };
}

function pickReadingA1Launch(url: string, unsubscribeUrl: string) {
  return {
    subject: "New A1 Reading lessons are now live 📚",
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;line-height:1.6">

      <div style="margin:0 0 18px;text-align:center">
        <img
          src="${LOGO_URL}"
          alt="Evo-English"
          style="max-width:180px;height:auto;display:inline-block;border:0;outline:none;text-decoration:none"
        />
      </div>

      <h2 style="margin:0 0 16px;font-size:28px;color:#111827;text-align:center">
        New A1 Reading lessons are now live 📚
      </h2>

      <p style="margin:0 0 14px">
        We’ve added a new <strong>Reading</strong> section for <strong>A1 Elementary</strong>.
      </p>

      <p style="margin:0 0 14px">
        You can start with short, simple texts, learn useful words in context, and improve your English step by step.
      </p>

      <p style="margin:0 0 22px">
        This is a great moment to come back, keep your progress moving, and make English part of your daily routine.
      </p>

      <p style="margin:0 0 26px;text-align:center">
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
          Start Reading
        </a>
      </p>

      <p style="margin:0 0 10px;color:#374151">
        See you on Evo-English,<br>
        <strong>The Evo-English team</strong>
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">

      <p style="font-size:12px;color:#6b7280;margin:0 0 8px">
        You received this email because you created an account on Evo-English.
      </p>

      <p style="font-size:12px;margin:0">
        <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">
          Unsubscribe
        </a>
      </p>
    </div>`,
    text: `New A1 Reading lessons are now live.

We’ve added a new Reading section for A1 Elementary.
Start with short, simple texts and improve your English step by step.

Open the lessons: ${url}

Unsubscribe: ${unsubscribeUrl}

See you on Evo-English.`,
  };
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  idempotencyKey?: string;
}) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const bodyText = await r.text();
  let parsed: unknown = bodyText;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    // keep raw text
  }

  return { ok: r.ok, status: r.status, data: parsed };
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);

  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers,
  });
}

async function hmacHex(input: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input)
  );

  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildUnsubscribeLink(userId: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const data = `${userId}:${cleanEmail}`;
  const sig = await hmacHex(data, UNSUBSCRIBE_SECRET);

  return `${SUPABASE_URL}/functions/v1/evo-mailer?action=unsubscribe&uid=${encodeURIComponent(
    userId
  )}&email=${encodeURIComponent(cleanEmail)}&sig=${sig}`;
}

async function hasReadingA1Log(userId: string) {
  const res = await supabaseRest(
    `user_nudge_log?select=user_id&user_id=eq.${encodeURIComponent(userId)}&milestone_days=eq.${READING_A1_MARK}&limit=1`
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to check user_nudge_log: ${txt}`);
  }

  const rows = (await res.json()) as Array<{ user_id: string }>;
  return rows.length > 0;
}

async function insertReadingA1Log(userId: string) {
  const res = await supabaseRest("user_nudge_log", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      milestone_days: READING_A1_MARK,
      sent_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to insert user_nudge_log: ${txt}`);
  }
}

async function handleUnsubscribe(req: Request) {
  const url = new URL(req.url);
  const userId = (url.searchParams.get("uid") || "").trim();
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const sig = (url.searchParams.get("sig") || "").trim();

  if (!userId || !email || !sig || !UNSUBSCRIBE_SECRET) {
    return htmlPage(
      `<!doctype html>
      <html>
        <head><meta charset="utf-8"><title>Invalid link</title></head>
        <body style="font-family:system-ui;padding:40px;max-width:680px;margin:auto;line-height:1.6">
          <h2>Invalid unsubscribe link</h2>
          <p>This link is incomplete or no longer valid.</p>
        </body>
      </html>`,
      400
    );
  }

  const expected = await hmacHex(`${userId}:${email}`, UNSUBSCRIBE_SECRET);

  if (sig !== expected) {
    return htmlPage(
      `<!doctype html>
      <html>
        <head><meta charset="utf-8"><title>Invalid link</title></head>
        <body style="font-family:system-ui;padding:40px;max-width:680px;margin:auto;line-height:1.6">
          <h2>Invalid unsubscribe link</h2>
          <p>This link is not valid.</p>
        </body>
      </html>`,
      400
    );
  }

  const res = await supabaseRest(
    `user_emails?user_id=eq.${encodeURIComponent(userId)}&email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ subscribed: false }),
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    return htmlPage(
      `<!doctype html>
      <html>
        <head><meta charset="utf-8"><title>Unsubscribe error</title></head>
        <body style="font-family:system-ui;padding:40px;max-width:680px;margin:auto;line-height:1.6">
          <h2>Could not unsubscribe</h2>
          <pre style="white-space:pre-wrap">${txt}</pre>
        </body>
      </html>`,
      500
    );
  }

  return htmlPage(
    `<!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Unsubscribed</title></head>
      <body style="font-family:system-ui;padding:40px;max-width:680px;margin:auto;line-height:1.6">
        <h2>You have been unsubscribed</h2>
        <p>You will no longer receive Reading launch emails from Evo-English.</p>
      </body>
    </html>`
  );
}

async function runReadingA1Broadcast(payload: any) {
  let limit = Number(payload?.limit ?? 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 10;

  const onlyEmail = String(payload?.only_email || "").trim().toLowerCase();
  const force = Boolean(payload?.force);

  let query = "select=user_id,email,subscribed&order=created_at.asc";
  if (onlyEmail) {
    query += `&email=eq.${encodeURIComponent(onlyEmail)}&limit=1`;
  } else {
    query += `&limit=${limit}`;
  }

  const usersRes = await supabaseRest(`user_emails?${query}`);

  if (!usersRes.ok) {
    const txt = await usersRes.text();
    throw new Error(`Failed to load user_emails: ${txt}`);
  }

  const users = (await usersRes.json()) as Array<{
    user_id: string;
    email: string;
    subscribed?: boolean | null;
  }>;

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const user of users) {
    const userId = String(user?.user_id || "").trim();
    const email = String(user?.email || "").trim().toLowerCase();

    if (!userId || !email) {
      failed.push({ email: email || "unknown", error: "missing_user_id_or_email" });
      continue;
    }

    if (user.subscribed === false) {
      skipped.push(email);
      continue;
    }

    try {
      if (!force) {
        const alreadySent = await hasReadingA1Log(userId);
        if (alreadySent) {
          skipped.push(email);
          continue;
        }
      }

      const unsubscribeUrl = await buildUnsubscribeLink(userId, email);
      const msg = pickReadingA1Launch(READING_A1_URL, unsubscribeUrl);

      const sendRes = await sendResendEmail({
        to: email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
idempotencyKey: `reading_a1_launch_v3:${userId}:${READING_A1_MARK}`,      });

      if (!sendRes.ok) {
        failed.push({
          email,
          error: `resend_failed_${sendRes.status}: ${JSON.stringify(sendRes.data)}`,
        });
        continue;
      }

      await insertReadingA1Log(userId);
      sent.push(email);
    } catch (err) {
      failed.push({
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({
    ok: true,
    campaign: "reading_a1_broadcast",
    reading_url: READING_A1_URL,
    sent_count: sent.length,
    skipped_count: skipped.length,
    failed_count: failed.length,
    sent,
    skipped,
    failed,
  });
}

serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  if (req.method === "GET" && action === "unsubscribe") {
    return await handleUnsubscribe(req);
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (EVO_CRON_SECRET) {
    const secret = req.headers.get("x-evo-secret") || "";
    if (secret !== EVO_CRON_SECRET) return json({ error: "unauthorized" }, 401);
  }

  const payload = (await req.json().catch(() => null)) as any;
  if (!payload?.type) return json({ error: "bad_payload" }, 400);

  if (payload.type === "admin_signup") {
    const userId = String(payload.user_id || "");
    const userEmail = String(payload.user_email || "");
    const createdAt = String(payload.created_at || "");
    const subject = `New signup: ${userEmail || userId}`;

    const html = `<div style="font-family:system-ui;line-height:1.55">
      <h2 style="margin:0 0 10px">New registration</h2>
      <p><b>Email:</b> ${userEmail || "—"}</p>
      <p><b>User ID:</b> ${userId || "—"}</p>
      <p><b>Created:</b> ${createdAt || "—"}</p>
    </div>`;

    const res = await sendResendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      subject,
      html,
      text: `New registration: ${userEmail} (id: ${userId}) created: ${createdAt}`,
      idempotencyKey: `admin_signup:${userId}:${createdAt}`,
    });

    return json(res, res.ok ? 200 : 500);
  }

  if (payload.type === "nudge") {
    const to = String(payload.to || "");
    const days = Number(payload.days || 0);
    const continueUrl = String(payload.continue_url || "https://www.evo-english.com/personal-account");
    if (!to) return json({ error: "missing_to" }, 400);

    const msg = pickNudge(days, continueUrl);
    const res = await sendResendEmail({
      to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      idempotencyKey: `nudge:${to}:${days}:${continueUrl}`,
    });

    return json(res, res.ok ? 200 : 500);
  }

  if (payload.type === "reading_a1_broadcast") {
    return await runReadingA1Broadcast(payload);
  }

  return json({ error: "unknown_type" }, 400);
});