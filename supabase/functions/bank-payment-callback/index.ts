
// supabase/functions/bank-payment-callback/index.ts
//
// IMPORTANT:
// This is a skeleton callback.
// Keep BANK_CALLBACK_ENABLED unset/false until real ePOS is connected.
// Do not use in production without verifying signature, amount, currency and payment status from bank docs.
//
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type BankPayload = {
  provider_order_id?: string;
  order_id?: string;

  provider_payment_id?: string;
  payment_id?: string;
  transaction_id?: string;

  status?: string;
  payment_status?: string;

  amount?: number | string;
  currency?: string;

  [key: string]: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bank-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function mapBankStatus(value: unknown): "pending" | "paid" | "failed" | "canceled" | "refunded" {
  const s = String(value || "").toLowerCase().trim();

  if (["paid", "success", "successful", "approved", "completed", "ok"].includes(s)) return "paid";
  if (["failed", "fail", "declined", "rejected", "error"].includes(s)) return "failed";
  if (["canceled", "cancelled", "void"].includes(s)) return "canceled";
  if (["refunded", "refund"].includes(s)) return "refunded";

  return "pending";
}

function addMonths(baseDate: Date, months: number) {
  const d = new Date(baseDate.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * TODO:
 * Replace this with the exact bank signature verification
 * after the bank gives you ePOS/vPOS documentation.
 */
async function verifyBankSignature(req: Request, rawBody: string) {
  const allowUnsignedCallback = Deno.env.get("ALLOW_UNSIGNED_BANK_CALLBACK") === "true";

  if (allowUnsignedCallback) {
    console.warn("[bank-payment-callback] Unsigned callbacks are enabled. Do not use this in production.");
    return true;
  }

  const signature = req.headers.get("x-bank-signature") || "";
  const secret = Deno.env.get("BANK_CALLBACK_SECRET") || "";

  if (!signature || !secret) {
    return false;
  }

  // Placeholder only.
  // Real implementation depends on bank docs:
  // HMAC-SHA256, RSA certificate, signed fields, etc.
  console.warn("[bank-payment-callback] Signature verification is not implemented yet.");
  console.warn("[bank-payment-callback] rawBody length:", rawBody.length);

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const callbackEnabled = Deno.env.get("BANK_CALLBACK_ENABLED") === "true";
    if (!callbackEnabled) {
      return json(503, {
        ok: false,
        error: "Bank payment callback is disabled",
      });
    }

    const rawBody = await req.text();

    const signatureOk = await verifyBankSignature(req, rawBody);
    if (!signatureOk) {
      return json(401, { ok: false, error: "Invalid payment signature" });
    }

    let payload: BankPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json(400, { ok: false, error: "Invalid JSON payload" });
    }

    const providerOrderId = String(payload.provider_order_id || payload.order_id || "").trim();

    if (!providerOrderId) {
      return json(400, { ok: false, error: "Missing provider_order_id/order_id" });
    }

    const providerPaymentId = String(
      payload.provider_payment_id ||
      payload.payment_id ||
      payload.transaction_id ||
      ""
    ).trim();

    const incomingStatus = payload.status || payload.payment_status;
    const mappedStatus = mapBankStatus(incomingStatus);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { ok: false, error: "Missing Supabase service credentials" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: payment, error: paymentErr } = await supabase
      .from("teacher_payments")
      .select("*")
      .eq("provider", "bank_epos")
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();

    if (paymentErr) {
      console.error("[bank-payment-callback] payment lookup error:", paymentErr);
      return json(500, { ok: false, error: "Payment lookup failed" });
    }

    if (!payment) {
      return json(404, {
        ok: false,
        error: "Payment order not found",
        provider_order_id: providerOrderId,
      });
    }

    const updatePayload: Record<string, unknown> = {
      status: mappedStatus,
      provider_payment_id: providerPaymentId || payment.provider_payment_id,
      raw_payload: payload,
    };

    if (mappedStatus === "paid") updatePayload.paid_at = new Date().toISOString();
    if (mappedStatus === "failed") updatePayload.failed_at = new Date().toISOString();
    if (mappedStatus === "canceled") updatePayload.canceled_at = new Date().toISOString();
    if (mappedStatus === "refunded") updatePayload.refunded_at = new Date().toISOString();

    const { data: updatedPayment, error: updatePaymentErr } = await supabase
      .from("teacher_payments")
      .update(updatePayload)
      .eq("id", payment.id)
      .select("*")
      .single();

    if (updatePaymentErr) {
      console.error("[bank-payment-callback] payment update error:", updatePaymentErr);
      return json(500, { ok: false, error: "Payment update failed" });
    }

    if (mappedStatus === "paid") {
      const { data: subscription, error: subErr } = await supabase
        .from("teacher_subscriptions")
        .select("*")
        .eq("teacher_id", payment.teacher_id)
        .maybeSingle();

      if (subErr) {
        console.error("[bank-payment-callback] subscription lookup error:", subErr);
        return json(500, { ok: false, error: "Subscription lookup failed" });
      }

      const now = new Date();
      const currentPeriodEnd = subscription?.current_period_end
        ? new Date(subscription.current_period_end)
        : null;

      const baseDate =
        currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()
          ? currentPeriodEnd
          : now;

      const nextPeriodEnd = addMonths(baseDate, Number(payment.period_months || 1));

      if (subscription) {
        const { error: updateSubErr } = await supabase
          .from("teacher_subscriptions")
          .update({
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: nextPeriodEnd.toISOString(),
            provider: "bank_epos",
            provider_subscription_id: providerOrderId,
          })
          .eq("id", subscription.id);

        if (updateSubErr) {
          console.error("[bank-payment-callback] subscription update error:", updateSubErr);
          return json(500, { ok: false, error: "Subscription update failed" });
        }
      } else {
        const { error: insertSubErr } = await supabase
          .from("teacher_subscriptions")
          .insert({
            teacher_id: payment.teacher_id,
            status: "active",
            trial_started_at: now.toISOString(),
            trial_ends_at: now.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: nextPeriodEnd.toISOString(),
            provider: "bank_epos",
            provider_subscription_id: providerOrderId,
          });

        if (insertSubErr) {
          console.error("[bank-payment-callback] subscription insert error:", insertSubErr);
          return json(500, { ok: false, error: "Subscription insert failed" });
        }
      }
    }

    return json(200, {
      ok: true,
      provider_order_id: providerOrderId,
      status: mappedStatus,
      payment_id: updatedPayment.id,
    });
  } catch (err) {
    console.error("[bank-payment-callback] unexpected error:", err);
    return json(500, {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error",
    });
  }
});
