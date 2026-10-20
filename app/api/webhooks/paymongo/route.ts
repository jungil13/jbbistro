import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { verifyPayMongoWebhookSignature } from "@/lib/paymongoRefund";
import { verifyAndFinalizePayMongoReservationAction } from "@/app/actions/paymongo";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY?.trim();
    if (!secret) {
      console.error("[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET_KEY is not configured.");
      return NextResponse.json(
        { error: "Webhook verification is not configured." },
        { status: 503 }
      );
    }

    const rawBody = await req.text();
    if (
      !verifyPayMongoWebhookSignature(
        rawBody,
        req.headers.get("paymongo-signature"),
        secret
      )
    ) {
      console.warn("[PayMongo Webhook] Invalid or stale signature rejected.");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const eventType = event?.data?.attributes?.type;
    if (eventType === "checkout_session.payment.paid") {
      const sessionId = event.data?.attributes?.data?.id;
      if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
        return NextResponse.json({ error: "Missing valid checkout session ID." }, { status: 400 });
      }

      const result = await verifyAndFinalizePayMongoReservationAction(sessionId);
      if (!result.success) {
        console.error("[PayMongo Webhook] Checkout finalization failed:", result.error);
        return NextResponse.json({ error: "Checkout payment could not be finalized." }, { status: 500 });
      }
      return NextResponse.json({ received: true, reservationId: result.reservationId });
    }

    if (eventType === "refund.created" || eventType === "refund.updated") {
      const refund = event.data?.attributes?.data;
      const attributes = refund?.attributes;
      const refundId = refund?.id;
      const paymentId = attributes?.payment_id;
      const amount = Number(attributes?.amount);
      const currency = attributes?.currency;
      const status = String(attributes?.status || "").toLowerCase();
      if (
        typeof refundId !== "string" ||
        !refundId.startsWith("ref_") ||
        typeof paymentId !== "string" ||
        !paymentId.startsWith("pay_") ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        typeof currency !== "string" ||
        !["succeeded", "pending", "processing", "failed"].includes(status)
      ) {
        return NextResponse.json(
          { error: "Refund event is missing valid provider status details." },
          { status: 400 }
        );
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceRoleKey) {
        console.error("[PayMongo Webhook] Supabase server credentials are not configured.");
        return NextResponse.json({ error: "Webhook processing is not configured." }, { status: 503 });
      }
      const supabase = createSupabaseAdmin(url, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // Find matching local refund record
      const { data: matchedRefund, error: findError } = await supabase
        .from("refunds")
        .select("id, status, payment_id, reservation_id, metadata")
        .or(`paymongo_refund_id.eq.${refundId},paymongo_payment_id.eq.${paymentId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error("[PayMongo Webhook] Refund lookup failed:", findError.message);
      }

      if (matchedRefund) {
        const meta = (matchedRefund.metadata as Record<string, any>) || {};
        const now = new Date().toISOString();
        const newStatus = status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : "processing";
        const newWf = status === "succeeded" ? "completed" : status === "failed" ? "failed" : status;

        await supabase
          .from("refunds")
          .update({
            status: newStatus,
            paymongo_refund_id: refundId,
            metadata: {
              ...meta,
              workflow_status: newWf,
              provider_payload: attributes,
              webhook_updated_at: now,
            },
            updated_at: now,
          })
          .eq("id", matchedRefund.id);

        if (status === "succeeded") {
          await supabase
            .from("payments")
            .update({ status: "refunded", updated_at: now })
            .eq("id", matchedRefund.payment_id);

          if (matchedRefund.reservation_id) {
            await supabase
              .from("reservations")
              .update({ status: "cancelled" })
              .eq("id", matchedRefund.reservation_id);
          }
        }

        return NextResponse.json({
          received: true,
          refundId,
          status,
          matched: true,
        });
      }

      return NextResponse.json({
        received: true,
        refundId,
        status,
        matched: false,
      });
    }

    if (eventType === "payment.refunded") {
      // Completion requires a refund-specific provider event so it can be matched
      // to the exact local refund record and amount.
      return NextResponse.json({
        received: true,
        status: "awaiting-refund-specific-event",
      });
    }

    return NextResponse.json({ received: true, event: eventType || "unknown" });
  } catch (error) {
    console.error("[PayMongo Webhook] Handler failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
