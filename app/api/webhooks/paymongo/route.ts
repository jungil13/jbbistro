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
      // Acknowledged
      return NextResponse.json({ received: true, paymentId });
    }

    // Default acknowledgement for other events (e.g. payment.failed, etc.)
    return NextResponse.json({ received: true, event: eventType });
  } catch (err: any) {
    console.error("[PayMongo Webhook] Uncaught handler error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
