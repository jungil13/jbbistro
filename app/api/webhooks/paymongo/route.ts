import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAndFinalizePayMongoReservationAction } from "@/app/actions/paymongo";

const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET_KEY || "";

/**
 * Validates PayMongo webhook signature if PAYMONGO_WEBHOOK_SECRET_KEY is configured.
 * Header format: "t=timestamp,te=test_signature,li=live_signature"
 */
function verifyPayMongoSignature(payload: string, signatureHeader: string | null): boolean {
  if (!PAYMONGO_WEBHOOK_SECRET) {
    // If no webhook secret is configured yet, allow processing by re-fetching
    // the checkout session directly from PayMongo's authenticated API.
    return true;
  }

  if (!signatureHeader) return false;

  try {
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let testSig = "";
    let liveSig = "";

    for (const part of parts) {
      const [key, val] = part.trim().split("=");
      if (key === "t") timestamp = val;
      if (key === "te") testSig = val;
      if (key === "li") liveSig = val;
    }

    const signatureToVerify = testSig || liveSig;
    if (!timestamp || !signatureToVerify) return false;

    const signaturePayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", PAYMONGO_WEBHOOK_SECRET)
      .update(signaturePayload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signatureToVerify),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    console.error("[PayMongo Webhook] Signature verification exception:", err);
    return false;
  }
}

/**
 * POST /api/webhooks/paymongo
 * PayMongo Webhook Endpoint to handle asynchronous payment events:
 * - checkout_session.payment.paid
 * - payment.paid
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("paymongo-signature");

    const isValid = verifyPayMongoSignature(rawBody, signatureHeader);
    if (!isValid) {
      console.warn("[PayMongo Webhook] Invalid signature rejected.");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    let event: any = null;
    try {
      event = JSON.parse(rawBody);
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const eventType = event?.data?.attributes?.type;
    console.log(`[PayMongo Webhook] Received event: ${eventType}`);

    // 1. Handle Checkout Session Payment Paid
    if (eventType === "checkout_session.payment.paid") {
      const checkoutSessionData = event.data?.attributes?.data;
      const sessionId = checkoutSessionData?.id;

      if (!sessionId) {
        console.warn("[PayMongo Webhook] Missing checkout session ID in event data.");
        return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
      }

      console.log(`[PayMongo Webhook] Processing paid checkout session: ${sessionId}`);
      const finalizeRes = await verifyAndFinalizePayMongoReservationAction(sessionId);

      if (finalizeRes.success) {
        console.log(`[PayMongo Webhook] Successfully finalized reservation ${finalizeRes.reservationId}`);
        return NextResponse.json({ received: true, reservationId: finalizeRes.reservationId });
      } else {
        console.warn(`[PayMongo Webhook] Finalization result:`, finalizeRes.error);
        return NextResponse.json({ received: true, status: finalizeRes.error });
      }
    }

    // 2. Handle generic Payment Paid
    if (eventType === "payment.paid") {
      const paymentData = event.data?.attributes?.data;
      const paymentId = paymentData?.id;
      console.log(`[PayMongo Webhook] Payment ${paymentId} paid.`);
      return NextResponse.json({ received: true, paymentId });
    }

    // 3. Handle PayMongo Refund Events (refund.created, refund.updated, payment.refunded)
    if (eventType === "refund.created" || eventType === "refund.updated") {
      const refundObj = event.data?.attributes?.data;
      const refundId = refundObj?.id;
      const refundAttrs = refundObj?.attributes || {};
      const payMongoPaymentId = refundAttrs.payment_id;
      const refundStatus = (refundAttrs.status || "succeeded").toLowerCase();
      const amountPhp = Number(refundAttrs.amount || 0) / 100;

      console.log(`[PayMongo Webhook] Processing ${eventType} for refund ${refundId} (Payment: ${payMongoPaymentId}, Status: ${refundStatus})`);

      if (payMongoPaymentId) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );

        // Find payment record
        const { data: payment } = await supabase
          .from("payments")
          .select("*, reservations(*)")
          .eq("reference_number", payMongoPaymentId)
          .maybeSingle();

        if (payment) {
          // Idempotently update or insert into refunds table
          try {
            await supabase
              .from("refunds")
              .upsert(
                [
                  {
                    reservation_id: payment.reservation_id,
                    payment_id: payment.id,
                    paymongo_payment_id: payMongoPaymentId,
                    paymongo_refund_id: refundId,
                    amount: amountPhp,
                    amount_centavos: refundAttrs.amount,
                    currency: refundAttrs.currency || "PHP",
                    reason: refundAttrs.reason || "others",
                    notes: refundAttrs.notes || "Processed via PayMongo webhook",
                    status: refundStatus === "succeeded" ? "succeeded" : "processing",
                    metadata: refundAttrs,
                    updated_at: new Date().toISOString(),
                  },
                ],
                { onConflict: "paymongo_refund_id" }
              );
          } catch (rErr) {
            console.warn("[PayMongo Webhook] refunds table update note:", rErr);
          }

          if (refundStatus === "succeeded") {
            // Update payment record
            try {
              await supabase
                .from("payments")
                .update({ status: "refunded" })
                .eq("id", payment.id);
            } catch {
              await supabase
                .from("payments")
                .update({ gcash_number: `PayMongo (REFUNDED: ${refundId})` })
                .eq("id", payment.id);
            }

            // Update reservation record to cancelled
            const auditTag = `[PayMongo Refund Webhook: ${refundId} | Status: SUCCEEDED | Amount: ₱${amountPhp.toLocaleString()}]`;
            const currentNotes = payment.reservations?.notes || "";
            if (!currentNotes.includes(refundId)) {
              await supabase
                .from("reservations")
                .update({
                  status: "cancelled",
                  notes: currentNotes ? `${currentNotes} | ${auditTag}` : auditTag,
                })
                .eq("id", payment.reservation_id);
            }
          }
        }
      }

      return NextResponse.json({ received: true, refundId, status: refundStatus });
    }

    if (eventType === "payment.refunded") {
      const paymentData = event.data?.attributes?.data;
      const paymentId = paymentData?.id;
      console.log(`[PayMongo Webhook] Payment ${paymentId} fully refunded.`);

      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      try {
        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("reference_number", paymentId);
      } catch {}

      return NextResponse.json({ received: true, paymentId, status: "refunded" });
    }

    // Default acknowledgement for other events (e.g. payment.failed, etc.)
    return NextResponse.json({ received: true, event: eventType });
  } catch (err: any) {
    console.error("[PayMongo Webhook] Uncaught handler error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
