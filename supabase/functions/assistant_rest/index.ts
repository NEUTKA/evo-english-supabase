// supabase/functions/assistant_rest/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Evo-English — Chat Assistant REST
 * - Only English-learning topics (A1–B2)
 * - Ultra concise answers (no fluff)
 * - Reply in the same language as user's last message (RU/EN)
 * - Input limit: 240 characters (hard)
 * - Mini-classifier (topic + language), aware of short follow-ups via context
 * - Optional moderation gate
 * - Server trims context (safety)
 */

// ====== ENV ======
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_BASE    = Deno.env.get("OPENAI_API_BASE") || "https://api.openai.com/v1";

// Models
const CHAT_MODEL     = Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini";
const CLS_MODEL      = Deno.env.get("OPENAI_CLASSIFIER_MODEL") || CHAT_MODEL;
const STT_MODEL      = Deno.env.get("OPENAI_WHISPER_MODEL") || "whisper-1";

// Output controls
const MAX_OUTPUT_TOKENS = Number(Deno.env.get("OPENAI_MAX_OUTPUT_TOKENS") || "160");
const TEMPERATURE       = Number(Deno.env.get("OPENAI_TEMPERATURE") || "0.2");

// Input + context controls
const MAX_USER_CHARS = 240;
const MAX_CONTEXT_MESSAGES = 12; // 6 pairs

// Optional moderation
const ENABLE_MODERATION =
  (Deno.env.get("OPENAI_ENABLE_MODERATION") || "true").toLowerCase() === "true";
const MOD_MODEL = Deno.env.get("OPENAI_MODERATION_MODEL") || "omni-moderation-latest";

// ===== Helpers =====
function json(body: unknown, base: Headers, status = 200) {
  const headers = new Headers(base);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function sanitizeUserText(s: string) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function detectLangHeuristic(text: string): "ru" | "en" | "other" {
  if (/[А-Яа-яЁё]/.test(text)) return "ru";
  if (/[A-Za-z]/.test(text)) return "en";
  return "other";
}

function rejectTooLong(lang: "ru" | "en" | "other") {
  return lang === "ru"
    ? "Слишком длинный текст. Пожалуйста, сократите до 240 символов."
    : "Your message is too long. Please keep it under 240 characters.";
}

function refuseOffTopic(lang: "ru" | "en" | "other") {
  return lang === "ru"
    ? "Извините, я отвечаю только на вопросы про изучение английского (грамматика, слова, исправление текста)."
    : "Sorry — I only help with learning English (grammar, vocabulary, correcting text).";
}

function refuseUnsafe(lang: "ru" | "en" | "other") {
  return lang === "ru"
    ? "Извините, я не могу помочь с таким запросом. Задайте безопасный вопрос про английский язык."
    : "Sorry — I can’t help with that. Please ask a safe English-learning question.";
}

function trimMessages(msgs: Array<{ role: string; content: string }>, keep = MAX_CONTEXT_MESSAGES) {
  if (!Array.isArray(msgs)) return [];
  const cleaned = msgs
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: sanitizeUserText(m.content) }))
    .filter(m => m.content.length > 0);

  if (cleaned.length <= keep) return cleaned;
  return cleaned.slice(-keep);
}

// ===== SYSTEM PROMPT =====
const SYSTEM_PROMPT = `
You are Evo-English AI Assistant.

Scope:
- You ONLY help with learning English (A1–B2): grammar, vocabulary, pronunciation, writing corrections, translation for learning, short exercises.

Hard rules:
- If the user asks about anything NOT related to learning English: refuse politely and STOP.
- Reply in the SAME language as the user's last message:
  - Russian -> Russian
  - English -> English
- Be ultra concise:
  - Max 1–3 short sentences OR 3–5 bullet points.
  - No long paragraphs, no extra explanations.
- If needed, ask ONE short clarification question.

Style rules:
- Never add introductions or conclusions.
- No emojis.
- No disclaimers unless refusing.
`;

// ===== Moderation (optional) =====
async function moderateText(text: string): Promise<{ flagged: boolean }> {
  const r = await fetch(`${OPENAI_BASE}/moderations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MOD_MODEL, input: text }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "Moderation request failed");

  const res = data?.results?.[0];
  return { flagged: !!res?.flagged };
}

// ===== Mini-classifier (topic + language), uses short context =====
type ClassifyResult = { english_related: boolean; lang: "ru" | "en" | "other" };

function buildClassifierContext(msgs: Array<{ role: string; content: string }>) {
  // Use the last 4 messages for context; keep it short
  const tail = msgs.slice(-4);
  let s = tail.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  if (s.length > 700) s = s.slice(-700);
  return s;
}

async function classifyFromMessages(
  msgs: Array<{ role: string; content: string }>,
  lastUserText: string
): Promise<ClassifyResult> {
  const ctx = buildClassifierContext(msgs);

  const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLS_MODEL,
      temperature: 0,
      max_tokens: 90,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
`Return ONLY valid JSON:
{"english_related":true|false,"lang":"ru"|"en"|"other"}

Rules:
- english_related=true ONLY if the user's intent (considering the short conversation context) is about learning English:
  grammar, vocabulary, translation for learning, correcting English text, pronunciation, exercises.
- Treat short follow-ups like "examples", "more", "continue", "ещё", "дай примеры" as english_related=true ONLY if the context is clearly about learning English.
- lang is the language of the user's LAST message (not the context).`,
        },
        {
          role: "user",
          content: `CONTEXT:\n${ctx}\n\nLAST USER MESSAGE:\n${lastUserText}`,
        },
      ],
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "Classifier request failed");

  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const obj = JSON.parse(raw);
    const lang: "ru" | "en" | "other" =
      obj?.lang === "ru" ? "ru" : obj?.lang === "en" ? "en" : "other";
    return { english_related: obj?.english_related === true, lang };
  } catch {
    return { english_related: false, lang: detectLangHeuristic(lastUserText) };
  }
}

// ===== Main chat =====
async function chat(
  messages: Array<{ role: string; content: string }>,
  lang: "ru" | "en" | "other",
) {
  const langRule =
    lang === "ru" ? "Reply in Russian." :
    lang === "en" ? "Reply in English." :
    "Reply in the user's language.";

  const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `${langRule} Keep it ultra concise.` },
        ...messages,
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "Chat request failed");

  const text = data?.choices?.[0]?.message?.content ?? "";
  return { text };
}

// ===== STT helpers =====
function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function stt(audio_base64: string, mime = "audio/webm") {
  const bytes = dataUrlToUint8Array(audio_base64);
  const blob  = new Blob([bytes], { type: mime });
  const form  = new FormData();
  form.append("file", new File([blob], `audio.${mime.split("/")[1] || "webm"}`, { type: mime }));
  form.append("model", STT_MODEL);

  const r = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "STT request failed");
  return { text: data?.text ?? "" };
}

// ===== Server =====
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Restrict unknown origins
  if (!cors.get("Access-Control-Allow-Origin")) {
    return new Response("Forbidden origin", { status: 403, headers: cors });
  }

  if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY is not set" }, cors, 500);

  try {
    const { action, messages, audio_base64, mime } = await req.json();

    // ===== CHAT =====
    if (action === "chat") {
      if (!Array.isArray(messages) || !messages.length) {
        return json({ error: "messages must be a non-empty array" }, cors, 400);
      }

      // Server-side: trim context no matter what client sends
      const safeMessages = trimMessages(messages, MAX_CONTEXT_MESSAGES);

      // Find last user message in trimmed context
      const lastUser = [...safeMessages].reverse().find(m => m.role === "user");
      const rawUserText = sanitizeUserText(lastUser?.content || "");

      const langGuess = detectLangHeuristic(rawUserText);

      if (!rawUserText) {
        return json({ text: "Please type an English-learning question." }, cors);
      }

      // Hard input limit (no API calls if exceeded)
      if (rawUserText.length > MAX_USER_CHARS) {
        return json({ text: rejectTooLong(langGuess) }, cors);
      }

      // Mini-classifier (topic + language) using short context
      const cls = await classifyFromMessages(safeMessages, rawUserText);

      // Optional moderation gate
      if (ENABLE_MODERATION) {
        const mod = await moderateText(rawUserText);
        if (mod.flagged) {
          return json({ text: refuseUnsafe(cls.lang) }, cors);
        }
      }

      // Topic gate
      if (!cls.english_related) {
        return json({ text: refuseOffTopic(cls.lang) }, cors);
      }

      // Answer (already trimmed context)
      const res = await chat(safeMessages, cls.lang);
      return json(res, cors);
    }

    // ===== STT =====
    if (action === "stt") {
      if (!audio_base64) return json({ error: "audio_base64 is required" }, cors, 400);
      const res = await stt(audio_base64, mime);
      return json(res, cors);
    }

    return json({ error: "Unknown action" }, cors, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, cors, 400);
  }
});
