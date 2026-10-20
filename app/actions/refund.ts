"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  requireAuthUser,
  requireRefundAuthorized,
} from "@/lib/supabase/authGuard";
import { classifyRefundResponse } from "@/lib/paymongoRefund";
import { sendEmail } from "@/lib/email";

export type RefundReason =
  | "duplicate"
  | "fraudulent"
  | "requested_by_customer"
  | "others";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFUND_REASONS: RefundReason[] = [
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "others",
];

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }
  return createSupabaseAdmin(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function getPayMongoAuthHeader() {
  const secretKey = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("PayMongo Secret Key is not configured.");
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function validReason(reason: unknown): reason is RefundReason {
  return typeof reason === "string" && REFUND_REASONS.includes(reason as RefundReason);
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected refund workflow error.";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function sendRefundUpdateEmail(
  to: string,
  subject: string,
  heading: string,
  message: string
) {
  const result = await sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #8b1327;">Jbenz Bistro - ${escapeHtml(heading)}</h2>
        <p>${escapeHtml(message)}</p>
        <p style="margin-top: 24px; color: #666; font-size: 12px;">Jbenz Bistro Team</p>
      </div>
    `,
  });
  if (!result.success) {
    console.error(`[Refund email] Could not send "${subject}" to ${to}:`, result.error);
  }
}

/**
 * Returns whether PayMongo is running in test mode.
 * Accessible to Admin, Manager, and Staff with billing permissions.
 */
export async function getPayMongoModeAction(): Promise<{ isTestMode: boolean }> {
  await requireRefundAuthorized();
  const secretKey = process.env.PAYMONGO_SECRET_KEY?.trim() || "";
  return { isTestMode: secretKey.startsWith("sk_test_") };
}

/**
 * Customer submits a refund request for an online payment.
 */
export async function submitRefundRequestAction(input: {
  reservationId: string;
  paymentId: string;
  reason: RefundReason;
  notes?: string;
}) {
  try {
    const { user, profile } = await requireAuthUser();
    if (
      !UUID_PATTERN.test(input?.reservationId || "") ||
      !UUID_PATTERN.test(input?.paymentId || "") ||
      !validReason(input?.reason)
    ) {
      return { success: false, error: "Refund request details are invalid." };
    }
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (notes.length > 500) {
      return { success: false, error: "Notes must be 500 characters or fewer." };
    }

    const supabase = getAdminSupabase();

    // 1. Verify reservation ownership
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("id, reservation_code, customer_id, customer_name, customer_email")
      .eq("id", input.reservationId)
      .single();

    if (resError || !reservation) {
      return { success: false, error: "Reservation was not found." };
    }

    const isOwner =
      reservation.customer_id === user.id ||
      (user.email && reservation.customer_email?.toLowerCase() === user.email.toLowerCase()) ||
      profile.role === "admin" ||
      profile.role === "manager";

    if (!isOwner) {
      return { success: false, error: "This reservation does not belong to your account." };
    }

    // 2. Verify payment eligibility
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("id, reservation_id, amount, status, reference_number")
      .eq("id", input.paymentId)
      .eq("reservation_id", input.reservationId)
      .single();

    if (payError || !payment) {
      return { success: false, error: "Payment transaction was not found." };
    }

    if (!["verified", "paid"].includes(payment.status)) {
      return { success: false, error: "Only verified or paid transactions are eligible for refund." };
    }

    const paymongoPaymentId = payment.reference_number?.trim();
    if (!paymongoPaymentId || !paymongoPaymentId.startsWith("pay_")) {
      return { success: false, error: "This payment was not made through PayMongo online." };
    }

    const amountNum = Number(payment.amount);
    const amountCentavos = Math.round(amountNum * 100);
    if (amountCentavos <= 0) {
      return { success: false, error: "Payment amount is invalid." };
    }

    // 3. Check for existing active refund for this payment
    const { data: existingRefunds } = await supabase
      .from("refunds")
      .select("id, status, metadata")
      .eq("payment_id", payment.id);

    const activeRefund = existingRefunds?.find((r) => {
      const wfStatus = (r.metadata as any)?.workflow_status;
      if (r.status === "succeeded") return true;
      if (r.status === "processing") return true;
      if (r.status === "pending" && wfStatus !== "rejected") return true;
      return false;
    });

    if (activeRefund) {
      return {
        success: false,
        error: "A refund request for this payment is already in progress or has already been completed.",
      };
    }

    // 4. Create refund record in 'refunds' table with workflow_status = 'requested'
    const { data: createdRefund, error: insertError } = await supabase
      .from("refunds")
      .insert({
        reservation_id: reservation.id,
        payment_id: payment.id,
        paymongo_payment_id: paymongoPaymentId,
        amount: amountNum,
        amount_centavos: amountCentavos,
        currency: "PHP",
        reason: input.reason,
        notes: notes || null,
        status: "pending",
        metadata: {
          workflow_status: "requested",
          customer_id: user.id,
          customer_name: reservation.customer_name,
          customer_email: user.email?.trim() || reservation.customer_email,
          reservation_code: reservation.reservation_code,
        },
      })
      .select()
      .single();

    if (insertError || !createdRefund) {
      console.error("[Refund request] Insertion failed:", insertError?.message);
      return { success: false, error: "Could not submit refund request. Please try again." };
    }

    // 5. Send notification to customer
    const resCode = reservation.reservation_code || reservation.id.slice(0, 8);
    try {
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: user.id,
        type: "payment",
        title: "Refund request submitted",
        message: `Your refund request for reservation #${resCode} is pending review.`,
        read: false,
      });
      if (notificationError) {
        console.error("[Refund request] Notification insert failed:", notificationError.message);
      }
    } catch (notificationError) {
      console.error("[Refund request] Notification insert failed:", safeErrorMessage(notificationError));
    }

    const customerEmail = user.email?.trim() || reservation.customer_email?.trim();
    if (customerEmail) {
      await sendRefundUpdateEmail(
        customerEmail,
        `Refund request received - Reservation #${resCode}`,
        "Refund Request Received",
        `We received your refund request for reservation #${resCode}. It is pending review by our team.`
      );
    }

    return { success: true, request: createdRefund };
  } catch (error) {
    console.error("[Refund request] Submission failed:", error);
    return { success: false, error: safeErrorMessage(error) };
  }
}

/**
 * Customer fetches their own refund requests.
 */
export async function getMyRefundRequestsAction() {
  try {
    const { user } = await requireAuthUser();

    const supabase = getAdminSupabase();
    const userEmail = user.email?.trim() || "";

    const { data, error } = await supabase
      .from("refunds")
      .select("*, reservations!inner(customer_id, customer_email, reservation_code), payments(amount)")
      .or(`customer_id.eq.${user.id}${userEmail ? `,customer_email.ilike.${userEmail}` : ""}`, {
        foreignTable: "reservations",
      })
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[Refund request] Query warning:", error.message);
      return { success: true, requests: [] };
    }

    const formatted = (data || []).map((r) => {
      const meta = (r.metadata as Record<string, any>) || {};
      let computedStatus = r.status;
      if (r.status === "pending") {
        computedStatus = meta.workflow_status || "requested";
      } else if (r.status === "succeeded") {
        computedStatus = "completed";
      } else if (r.status === "failed") {
        computedStatus = meta.workflow_status === "rejected" ? "rejected" : "failed";
      }

      return {
        id: r.id,
        reservation_id: r.reservation_id,
        payment_id: r.payment_id,
        amount_centavos: r.amount_centavos,
        reason: r.reason,
        notes: r.notes,
        status: computedStatus,
        admin_notes: meta.admin_notes || (computedStatus === "rejected" ? r.failure_reason : null),
        failure_reason: r.failure_reason,
        provider_refund_id: r.paymongo_refund_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        reservations: r.reservations,
        payments: r.payments,
      };
    });

    return { success: true, requests: formatted };
  } catch (error) {
    console.warn("[Refund request] Could not load customer requests:", error);
    return { success: true, requests: [] };
  }
}

/**
 * Admin, Manager, or Staff with billing permission fetches all refund requests.
 */
export async function getAdminRefundRequestsAction() {
  try {
    await requireRefundAuthorized();
    const supabase = getAdminSupabase();

    const { data, error } = await supabase
      .from("refunds")
      .select(
        "*, reservations(reservation_code, customer_name, customer_email), payments(amount, status, reference_number)"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map((r) => {
      const meta = (r.metadata as Record<string, any>) || {};
      let computedStatus = r.status;
      if (r.status === "pending") {
        computedStatus = meta.workflow_status || "requested";
      } else if (r.status === "succeeded") {
        computedStatus = "completed";
      } else if (r.status === "failed") {
        computedStatus = meta.workflow_status === "rejected" ? "rejected" : "failed";
      } else if (meta.workflow_status === "ambiguous") {
        computedStatus = "ambiguous";
      }

      return {
        id: r.id,
        reservation_id: r.reservation_id,
        payment_id: r.payment_id,
        paymongo_payment_id: r.paymongo_payment_id,
        amount_centavos: r.amount_centavos,
        reason: r.reason,
        notes: r.notes,
        status: computedStatus,
        admin_notes: meta.admin_notes || (computedStatus === "rejected" ? r.failure_reason : null),
        failure_reason: r.failure_reason,
        provider_refund_id: r.paymongo_refund_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        decided_at: meta.decided_at || null,
        reservations: r.reservations,
        payments: r.payments,
      };
    });

    return { success: true, requests: formatted };
  } catch (error) {
    console.error("[Refund request] Could not load admin queue:", error);
    return { success: false, requests: [], error: safeErrorMessage(error) };
  }
}

/**
 * Admin, Manager, or Staff with billing permission reviews (approves/rejects) a customer refund request.
 */
export async function reviewRefundRequestAction(input: {
  requestId: string;
  approve: boolean;
  rejectionReason?: string;
}) {
  try {
    const { user, profile } = await requireRefundAuthorized();
    if (!UUID_PATTERN.test(input?.requestId || "") || typeof input.approve !== "boolean") {
      return { success: false, error: "Refund review details are invalid." };
    }

    const rejectionReason =
      typeof input.rejectionReason === "string" ? input.rejectionReason.trim() : "";
    if (!input.approve && (!rejectionReason || rejectionReason.length > 500)) {
      return {
        success: false,
        error: "A rejection reason of 1 to 500 characters is required.",
      };
    }

    const supabase = getAdminSupabase();

    // 1. Fetch current refund record
    const { data: currentRefund, error: fetchErr } = await supabase
      .from("refunds")
      .select("*, reservations(reservation_code, customer_id, customer_email)")
      .eq("id", input.requestId)
      .single();

    if (fetchErr || !currentRefund) {
      return { success: false, error: "Refund request not found." };
    }

    const currentMeta = (currentRefund.metadata as Record<string, any>) || {};
    const currentWf = currentMeta.workflow_status || (currentRefund.status === "pending" ? "requested" : currentRefund.status);

    if (currentWf !== "requested" && currentRefund.status !== "pending") {
      return { success: false, error: "This request has already been reviewed." };
    }

    const now = new Date().toISOString();
    let updatePayload: Record<string, any>;

    if (input.approve) {
      updatePayload = {
        admin_id: user.id,
        admin_email: profile.email,
        status: "pending",
        failure_reason: null,
        metadata: {
          ...currentMeta,
          workflow_status: "approved",
          approved_by: user.id,
          reviewer_role: profile.role,
          decided_at: now,
        },
        updated_at: now,
      };
    } else {
      updatePayload = {
        admin_id: user.id,
        admin_email: profile.email,
        status: "failed",
        failure_reason: rejectionReason,
        metadata: {
          ...currentMeta,
          workflow_status: "rejected",
          rejected_by: user.id,
          reviewer_role: profile.role,
          admin_notes: rejectionReason,
          decided_at: now,
        },
        updated_at: now,
      };
    }

    const { data: updatedRefund, error: updateErr } = await supabase
      .from("refunds")
      .update(updatePayload)
      .eq("id", input.requestId)
      .select()
      .single();

    if (updateErr || !updatedRefund) {
      console.error("[Refund review] Update failed:", updateErr?.message);
      return { success: false, error: "Could not update the refund request." };
    }

    // Notify customer
    const customerId = currentRefund.reservations?.customer_id || currentMeta.customer_id;
    const resCode = currentRefund.reservations?.reservation_code || currentRefund.reservation_id.slice(0, 8);

    const notificationTitle = input.approve
      ? "Refund request approved"
      : "Refund request rejected";
    const notificationMessage = input.approve
      ? `Your refund request for reservation #${resCode} was approved and is queued for processing.`
      : `Your refund request for reservation #${resCode} was rejected: ${rejectionReason}`;

    if (customerId) {
      try {
        const { error: notificationError } = await supabase.from("notifications").insert({
          user_id: customerId,
          type: input.approve ? "payment" : "warning",
          title: notificationTitle,
          message: notificationMessage,
          read: false,
        });
        if (notificationError) {
          console.error("[Refund review] Notification insert failed:", notificationError.message);
        }
      } catch (notificationError) {
        console.error("[Refund review] Notification insert failed:", safeErrorMessage(notificationError));
      }
    }

    const customerEmail =
      currentRefund.reservations?.customer_email?.trim() ||
      String(currentMeta.customer_email || "").trim();
    if (customerEmail) {
      await sendRefundUpdateEmail(
        customerEmail,
        `${notificationTitle} - Reservation #${resCode}`,
        notificationTitle,
        notificationMessage
      );
    }

    return { success: true, request: updatedRefund };
  } catch (error) {
    console.error("[Refund request] Review failed:", error);
    return { success: false, error: safeErrorMessage(error) };
  }
}

/**
 * Admin, Manager, or Staff with billing permission processes an approved refund through PayMongo.
 */
export async function processApprovedRefundAction(
  requestId: string,
  confirmed: boolean
) {
  try {
    const { user, profile } = await requireRefundAuthorized();
    if (!UUID_PATTERN.test(requestId || "") || confirmed !== true) {
      return {
        success: false,
        error: "Confirm the approved refund before processing it.",
      };
    }

    const supabase = getAdminSupabase();

    // 1. Fetch refund record and verify it is approved
    const { data: refund, error: fetchErr } = await supabase
      .from("refunds")
      .select("*, reservations(reservation_code, customer_id, customer_name, customer_email), payments(amount, status, reference_number)")
      .eq("id", requestId)
      .single();

    if (fetchErr || !refund) {
      return { success: false, error: "Refund request record was not found." };
    }

    const meta = (refund.metadata as Record<string, any>) || {};
    const wfStatus = meta.workflow_status;

    if (refund.status === "succeeded") {
      return { success: false, error: "This refund has already been completed." };
    }

    if (wfStatus !== "approved" && refund.status !== "pending") {
      return {
        success: false,
        error: "This request must be approved by a verifier before it can be processed.",
      };
    }

    // 2. Mark as processing to prevent duplicate simultaneous clicks
    const now = new Date().toISOString();
    await supabase
      .from("refunds")
      .update({
        status: "processing",
        metadata: {
          ...meta,
          workflow_status: "processing",
          processor_id: user.id,
          processor_role: profile.role,
          processing_started_at: now,
        },
        updated_at: now,
      })
      .eq("id", requestId);

    // 3. Call PayMongo API
    const authorization = getPayMongoAuthHeader();
    const idempotencyKey = `refund-req-${requestId}`;

    let response: Response;
    try {
      response = await fetch("https://api.paymongo.com/v1/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: refund.amount_centavos,
              payment_id: refund.paymongo_payment_id,
              reason: refund.reason,
              notes: refund.notes || `Refund for reservation ${refund.reservations?.reservation_code || refund.reservation_id}`,
            },
          },
        }),
        cache: "no-store",
      });
    } catch (fetchError) {
      // Ambiguous network failure
      await supabase
        .from("refunds")
        .update({
          failure_reason: `PayMongo response could not be confirmed: ${safeErrorMessage(fetchError)}`,
          metadata: {
            ...meta,
            workflow_status: "ambiguous",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return {
        success: false,
        ambiguous: true,
        error:
          "PayMongo network timeout. Status could not be verified immediately; check PayMongo dashboard before retrying.",
      };
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const providerResult = classifyRefundResponse(
      response.status,
      payload,
      refund.paymongo_payment_id,
      Number(refund.amount_centavos)
    );

    const updateTime = new Date().toISOString();

    if (providerResult.status === "succeeded") {
      // 4a. Update refund record to succeeded
      await supabase
        .from("refunds")
        .update({
          status: "succeeded",
          paymongo_refund_id: providerResult.refundId,
          failure_reason: null,
          metadata: {
            ...meta,
            workflow_status: "completed",
            provider_payload: providerResult.metadata,
            completed_at: updateTime,
          },
          updated_at: updateTime,
        })
        .eq("id", requestId);

      // 4b. Update payments table to 'refunded'
      await supabase
        .from("payments")
        .update({
          status: "refunded",
          updated_at: updateTime,
        })
        .eq("id", refund.payment_id);

      // 4c. Update reservation status to 'cancelled' so it is excluded from active bookings & revenue
      await supabase
        .from("reservations")
        .update({
          status: "cancelled",
        })
        .eq("id", refund.reservation_id);

      // 4d. Notify customer
      const customerId = refund.reservations?.customer_id || meta.customer_id;
      const resCode = refund.reservations?.reservation_code || refund.reservation_id.slice(0, 8);
      const formattedAmount = (Number(refund.amount_centavos) / 100).toLocaleString();

      if (customerId) {
        try {
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "payment",
            title: "Refund completed",
            message: `Your refund of ₱${formattedAmount} for reservation #${resCode} was processed successfully via PayMongo.`,
            read: false,
          });
        } catch (notifErr) {
          console.warn("[PayMongo Refund] Notification failed:", notifErr);
        }
      }

      // Send email if customer email exists
      const customerEmail = refund.reservations?.customer_email || meta.customer_email;
      if (customerEmail) {
        try {
          await sendEmail({
            to: customerEmail,
            subject: `Refund Processed: Reservation #${resCode}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #8b1327;">Jbenz Bistro - Refund Confirmation</h2>
                <p>Dear Valued Guest,</p>
                <p>Your refund of <strong>₱${formattedAmount}</strong> for reservation <strong>#${resCode}</strong> has been successfully processed through PayMongo.</p>
                <p><strong>PayMongo Refund ID:</strong> ${providerResult.refundId}</p>
                <p>Depending on your payment method or bank, funds will reflect in your account within standard banking settlement days.</p>
                <p style="margin-top: 24px; color: #666; font-size: 12px;">Thank you for your patronage.<br/>Jbenz Bistro Team</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.warn("[PayMongo Refund] Email confirmation failed:", emailErr);
        }
      }

      return {
        success: true,
        status: "completed",
        providerRefundId: providerResult.refundId,
        message: "PayMongo confirmed the refund is complete.",
      };
    } else if (providerResult.status === "failed") {
      // 4d. Provider rejected the refund
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          failure_reason: providerResult.failureReason,
          metadata: {
            ...meta,
            workflow_status: "failed",
            provider_payload: providerResult.metadata,
          },
          updated_at: updateTime,
        })
        .eq("id", requestId);

      return {
        success: false,
        error: providerResult.failureReason || "PayMongo rejected the refund.",
      };
    } else {
      // 4e. Pending / ambiguous status
      await supabase
        .from("refunds")
        .update({
          status: providerResult.status === "pending" ? "processing" : "pending",
          paymongo_refund_id: providerResult.refundId,
          failure_reason: providerResult.failureReason,
          metadata: {
            ...meta,
            workflow_status: providerResult.status,
            provider_payload: providerResult.metadata,
          },
          updated_at: updateTime,
        })
        .eq("id", requestId);

      return {
        success: true,
        status: providerResult.status,
        providerRefundId: providerResult.refundId,
        message: "PayMongo accepted the refund request; awaiting provider confirmation.",
      };
    }
  } catch (error) {
    console.error("[PayMongo Refund] Processing failed:", error);
    return { success: false, error: safeErrorMessage(error) };
  }
}

/**
 * Reconcile a refund status directly from PayMongo's refund status endpoint.
 */
export async function reconcilePayMongoRefundStatusAction(
  reservationId: string,
  refundId?: string
) {
  try {
    await requireRefundAuthorized();
    if (!UUID_PATTERN.test(reservationId || "") || !refundId?.startsWith("ref_")) {
      return { success: false, error: "A valid PayMongo refund reference is required." };
    }

    const supabase = getAdminSupabase();
    const { data: localRefund, error: localError } = await supabase
      .from("refunds")
      .select("id, paymongo_payment_id, amount_centavos, reservation_id, payment_id, metadata")
      .eq("reservation_id", reservationId)
      .eq("paymongo_refund_id", refundId)
      .maybeSingle();

    if (localError || !localRefund) {
      return { success: false, error: "Refund record was not found for this reservation." };
    }

    const response = await fetch(
      `https://api.paymongo.com/v1/refunds/${encodeURIComponent(refundId)}`,
      {
        headers: { Authorization: getPayMongoAuthHeader(), Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return { success: false, error: `PayMongo status lookup failed (${response.status}).` };
    }

    const payload = await response.json();
    const refund = payload?.data;
    const attrs = refund?.attributes || {};
    const providerStatus = String(attrs.status || "").toLowerCase();

    const now = new Date().toISOString();
    const currentMeta = (localRefund.metadata as Record<string, any>) || {};

    if (providerStatus === "succeeded") {
      await supabase
        .from("refunds")
        .update({
          status: "succeeded",
          metadata: {
            ...currentMeta,
            workflow_status: "completed",
            provider_payload: attrs,
            reconciled_at: now,
          },
          updated_at: now,
        })
        .eq("id", localRefund.id);

      await supabase
        .from("payments")
        .update({ status: "refunded", updated_at: now })
        .eq("id", localRefund.payment_id);

      await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", localRefund.reservation_id);
    } else if (providerStatus === "failed") {
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          metadata: {
            ...currentMeta,
            workflow_status: "failed",
            reconciled_at: now,
          },
          updated_at: now,
        })
        .eq("id", localRefund.id);
    } else {
      await supabase
        .from("refunds")
        .update({
          metadata: {
            ...currentMeta,
            provider_payload: attrs,
            reconciled_at: now,
          },
          updated_at: now,
        })
        .eq("id", localRefund.id);
    }

    return { success: true, message: `Refund status reconciled with PayMongo (${providerStatus}).` };
  } catch (error) {
    console.error("[PayMongo Refund] Reconciliation failed:", error);
    return { success: false, error: safeErrorMessage(error) };
  }
}

/**
 * Audit log of all refunds for a specific reservation.
 */
export async function getReservationRefundsAction(reservationId: string) {
  try {
    await requireRefundAuthorized();
    if (!UUID_PATTERN.test(reservationId || "")) {
      return { success: false, refunds: [], error: "Reservation ID is invalid." };
    }
    const supabase = getAdminSupabase();
    const { data: refunds, error } = await supabase
      .from("refunds")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, refunds: refunds || [] };
  } catch (error) {
    console.error("[Refund audit] Could not load reservation refunds:", error);
    return { success: false, refunds: [], error: safeErrorMessage(error) };
  }
}

/**
 * Backward compatibility wrapper.
 */
export async function processPayMongoRefundAction(input?: {
  reservationId?: string;
  paymentId?: string;
  reason?: RefundReason;
  notes?: string;
}) {
  await requireRefundAuthorized();

  if (input?.reservationId || input?.paymentId || input?.reason || input?.notes) {
    const request = await submitRefundRequestAction({
      reservationId: input.reservationId || "",
      paymentId: input.paymentId || "",
      reason: input.reason || "requested_by_customer",
      notes: input.notes,
    });

    if (request.success) {
      return {
        success: true,
        status: "pending",
        message: "Refund request submitted successfully and is awaiting review.",
        refundId: (request.request as any)?.id ?? null,
      };
    }

    return {
      success: false,
      error: request.error || "Refund request could not be submitted.",
      status: "failed",
      message: request.error || "Refund request could not be submitted.",
    };
  }

  return {
    success: false,
    error: "Direct refunds without a request are disabled. Review and process an approved customer refund request.",
    status: "failed",
    message: "Direct refunds without a request are disabled. Review and process an approved customer refund request.",
    refundId: null,
  };
}
