"use server";

import { createClient } from "@supabase/supabase-js";
import { requireAdminOrManager } from "@/lib/supabase/authGuard";
import { sendEmail, getPublicSiteUrl } from "@/lib/email";
import { formatDate, formatTime } from "@/lib/dateUtils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iqqgysfbtqcgkuwvssqh.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxcWd5c2ZidHFjZ2t1d3Zzc3FoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkyMjk1MSwiZXhwIjoyMDk5NDk4OTUxfQ.zDUyaKC0Q_VHAnFMF9wghlUfAZSnrIjmND5YqglMl7w",
  { auth: { persistSession: false } }
);

export type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer" | "others";

export interface ProcessRefundInput {
  reservationId: string;
  paymentId?: string;
  reason: RefundReason;
  notes?: string;
}

export interface RefundRecord {
  id: string;
  reservation_id: string;
  payment_id: string;
  paymongo_payment_id: string;
  paymongo_refund_id?: string | null;
  amount: number;
  currency: string;
  reason: RefundReason;
  notes?: string | null;
  status: "pending" | "processing" | "succeeded" | "failed";
  admin_id?: string | null;
  admin_email?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * Returns basic auth header for PayMongo secret API
 */
function getPayMongoAuthHeader(): string {
  const secretKey = (process.env.PAYMONGO_SECRET_KEY || "").trim();
  if (!secretKey) {
    throw new Error("PayMongo Secret Key is missing from server environment (PAYMONGO_SECRET_KEY).");
  }
  return "Basic " + Buffer.from(secretKey + ":").toString("base64");
}

/**
 * Check if current PayMongo configuration is in Test Mode
 */
export async function getPayMongoModeAction(): Promise<{ isTestMode: boolean }> {
  const secretKey = (process.env.PAYMONGO_SECRET_KEY || "").trim();
  return { isTestMode: secretKey.startsWith("sk_test_") };
}

/**
 * Process a full refund through PayMongo for an eligible reservation payment.
 * Exclusively executed on the server, authenticated with requireAdminOrManager.
 */
export async function processPayMongoRefundAction(input: ProcessRefundInput) {
  try {
    // 1. Strict Server-Side Role Check (Admin or Manager only)
    const { profile } = await requireAdminOrManager();
    const adminEmail = profile.email || "admin@jbenzbistro.com";
    const adminId = profile.id;

    if (!input.reservationId) {
      return { success: false, error: "Reservation ID is required." };
    }

    // 2. Fetch reservation, payments, and customer data from trusted DB
    const { data: reservation, error: resErr } = await supabase
      .from("reservations")
      .select("*, payments(*), services(name, type)")
      .eq("id", input.reservationId)
      .single();

    if (resErr || !reservation) {
      return { success: false, error: "Reservation not found in system records." };
    }

    // Identify target payment
    const payments = Array.isArray(reservation.payments) ? reservation.payments : (reservation.payments ? [reservation.payments] : []);
    const payment = input.paymentId 
      ? payments.find((p: any) => p.id === input.paymentId)
      : payments.find((p: any) => p.reference_number?.startsWith("pay_")) || payments[0];

    if (!payment) {
      return { success: false, error: "No payment transaction found associated with this booking." };
    }

    // 3. Strict Payment Eligibility Validations
    const payMongoPaymentId = payment.reference_number;
    if (!payMongoPaymentId || !payMongoPaymentId.startsWith("pay_")) {
      return {
        success: false,
        error: "This booking was not processed online via PayMongo (e.g. manual Cash on Arrival). PayMongo refunds can only be issued for verified PayMongo transactions.",
      };
    }

    if (payment.status === "refunded") {
      return { success: false, error: "This payment has already been fully refunded." };
    }

    if (payment.status !== "verified" && payment.status !== "paid") {
      return {
        success: false,
        error: `Cannot refund payment in '${payment.status}' status. Only verified payments can be refunded.`,
      };
    }

    const originalAmount = Number(payment.amount || reservation.total_amount || 0);
    if (originalAmount <= 0) {
      return { success: false, error: "Payment amount must be greater than zero to issue a refund." };
    }

    // 4. Duplicate Check: Ensure no existing active/succeeded refund
    // Check refunds table if available
    try {
      const { data: existingRefunds } = await supabase
        .from("refunds")
        .select("*")
        .eq("payment_id", payment.id)
        .in("status", ["succeeded", "pending", "processing"]);

      if (existingRefunds && existingRefunds.length > 0) {
        const active = existingRefunds[0];
        if (active.status === "succeeded") {
          return { success: false, error: `Payment already refunded (PayMongo Ref: ${active.paymongo_refund_id || active.id}).` };
        }
        return { success: false, error: "A refund request for this payment is currently processing. Please wait or check reconciliation status." };
      }
    } catch {
      // If table does not exist yet, check reservation notes for existing refund tag
      if (reservation.notes?.includes("[PayMongo Refund Succeeded:")) {
        return { success: false, error: "This reservation is already marked as refunded in system records." };
      }
    }

    // 5. Atomic Reservation: Register pre-refund state
    const amountCentavos = Math.round(originalAmount * 100);
    let internalRefundId = crypto.randomUUID();

    try {
      await supabase.from("refunds").insert([
        {
          id: internalRefundId,
          reservation_id: reservation.id,
          payment_id: payment.id,
          paymongo_payment_id: payMongoPaymentId,
          amount: originalAmount,
          amount_centavos: amountCentavos,
          currency: "PHP",
          reason: input.reason,
          notes: input.notes || `Refund initiated by ${adminEmail}`,
          status: "pending",
          admin_id: adminId,
          admin_email: adminEmail,
        },
      ]);
    } catch (insertErr) {
      console.warn("Notice: refunds table insert skipped or unavailable:", insertErr);
    }

    // 6. Execute PayMongo Official Refund API Call
    const authHeader = getPayMongoAuthHeader();
    const refundPayload = {
      data: {
        attributes: {
          amount: amountCentavos,
          payment_id: payMongoPaymentId,
          reason: input.reason,
          notes: input.notes
            ? `${input.notes} | Authorized by ${adminEmail}`
            : `Full booking refund authorized by ${adminEmail}`,
        },
      },
    };

    console.log(`[PayMongo Refund] Calling API for payment ${payMongoPaymentId}, amount: ${originalAmount} PHP (${amountCentavos} centavos)`);

    let response: Response;
    try {
      response = await fetch("https://api.paymongo.com/v1/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          Accept: "application/json",
        },
        body: JSON.stringify(refundPayload),
        cache: "no-store",
      });
    } catch (netErr: any) {
      console.error("[PayMongo Refund] Network failure during API call:", netErr);
      // Mark refund as pending reconciliation rather than failed
      try {
        await supabase
          .from("refunds")
          .update({
            status: "pending",
            failure_reason: `Network timeout / connection issue: ${netErr.message}. Awaiting reconciliation.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", internalRefundId);
      } catch {}

      return {
        success: false,
        error: "Network connection to PayMongo timed out. The refund request may be processing at the gateway. Please click 'Reconcile Status' to verify before re-submitting.",
        requiresReconciliation: true,
      };
    }

    const result = await response.json();

    if (!response.ok || !result?.data) {
      console.error("[PayMongo Refund] Provider returned error:", result);
      const rawError = result?.errors?.[0]?.detail || result?.errors?.[0]?.code || "PayMongo rejected the refund request.";

      // Update refund audit trail to failed
      try {
        await supabase
          .from("refunds")
          .update({
            status: "failed",
            failure_reason: rawError,
            updated_at: new Date().toISOString(),
          })
          .eq("id", internalRefundId);
      } catch {}

      return { success: false, error: `PayMongo Refund Error: ${rawError}` };
    }

    // 7. Successful Provider Acceptance
    const refundData = result.data;
    const providerRefundId = refundData.id;
    const providerStatus = (refundData.attributes?.status || "succeeded").toLowerCase();

    console.log(`[PayMongo Refund] Provider accepted. Refund ID: ${providerRefundId}, status: ${providerStatus}`);

    // Update refund record
    try {
      await supabase
        .from("refunds")
        .update({
          paymongo_refund_id: providerRefundId,
          status: providerStatus === "succeeded" ? "succeeded" : "processing",
          metadata: refundData.attributes || {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", internalRefundId);
    } catch {}

    // 8. Update Reservation and Payment records
    const auditTag = `[PayMongo Refund: ${providerRefundId} | Status: ${providerStatus.toUpperCase()} | Amount: ₱${originalAmount.toLocaleString()} | Reason: ${input.reason} | Authorized By: ${adminEmail}]`;
    const updatedNotes = reservation.notes ? `${reservation.notes} | ${auditTag}` : auditTag;

    // Update reservation status to cancelled
    await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        notes: updatedNotes,
      })
      .eq("id", reservation.id);

    // Update payment record (try updating status to 'refunded')
    try {
      const { error: payUpdateErr } = await supabase
        .from("payments")
        .update({
          status: "refunded",
          gcash_number: `PayMongo (${providerRefundId})`,
        })
        .eq("id", payment.id);

      if (payUpdateErr) {
        console.warn("Could not update payments.status to 'refunded' (schema check constraint may need migration):", payUpdateErr.message);
        // Fallback update without altering status column to prevent DB crash
        await supabase
          .from("payments")
          .update({
            gcash_number: `PayMongo (REFUNDED: ${providerRefundId})`,
          })
          .eq("id", payment.id);
      }
    } catch (e) {
      console.warn("Payment update warning:", e);
    }

    // 9. Customer Notifications (In-app + Email)
    if (reservation.customer_id) {
      try {
        await supabase.from("notifications").insert([
          {
            user_id: reservation.customer_id,
            type: "payment",
            title: providerStatus === "succeeded" ? "Refund Succeeded" : "Refund Processing",
            message: `Your payment of ₱${originalAmount.toLocaleString()} for reservation #${reservation.reservation_code || reservation.id.slice(0, 8)} has been refunded via PayMongo (Ref: ${providerRefundId}).`,
            read: false,
          },
        ]);
      } catch (notifErr) {
        console.warn("Notification insert warning:", notifErr);
      }
    }

    // Send confirmation email
    const customerEmail = reservation.customer_email || reservation.email;
    if (customerEmail) {
      sendRefundNoticeEmail({
        recipientEmail: customerEmail,
        customerName: reservation.customer_name || "Valued Guest",
        reservationCode: reservation.reservation_code || reservation.id.slice(0, 8).toUpperCase(),
        serviceName: reservation.services?.name || "Bistro Booking",
        amountRefunded: originalAmount,
        providerRefundId,
        refundReason: input.reason,
        status: providerStatus,
      }).catch((emailErr) => console.warn("Refund email dispatch error:", emailErr));
    }

    return {
      success: true,
      refundId: providerRefundId,
      status: providerStatus,
      amount: originalAmount,
      message:
        providerStatus === "succeeded"
          ? `Successfully refunded ₱${originalAmount.toLocaleString()} through PayMongo (Ref: ${providerRefundId}).`
          : `Refund request submitted to PayMongo and is currently ${providerStatus}. Funds will settle shortly.`,
    };
  } catch (err: any) {
    console.error("[PayMongo Refund] Unhandled exception:", err);
    return { success: false, error: err.message || "An unexpected error occurred during refund processing." };
  }
}

/**
 * Fetch existing refund details for a given reservation
 */
export async function getReservationRefundsAction(reservationId: string) {
  try {
    if (!reservationId) return { success: false, refunds: [] };

    // 1. Try querying the dedicated refunds table
    try {
      const { data, error } = await supabase
        .from("refunds")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return { success: true, refunds: data };
      }
    } catch {}

    // 2. Fallback: Parse refund details from reservation notes if table was empty
    const { data: res } = await supabase
      .from("reservations")
      .select("id, reservation_code, notes, payments(*)")
      .eq("id", reservationId)
      .single();

    if (res?.notes && res.notes.includes("[PayMongo Refund:")) {
      const match = res.notes.match(/\[PayMongo Refund:\s*([^\s|]+)\s*\|\s*Status:\s*([^\s|]+)\s*\|\s*Amount:\s*([^|]+)\s*\|\s*Reason:\s*([^|]+)\s*\|\s*Authorized By:\s*([^\]]+)\]/i);
      if (match) {
        return {
          success: true,
          refunds: [
            {
              id: "parsed-from-notes",
              reservation_id: reservationId,
              payment_id: res.payments?.[0]?.id || "",
              paymongo_payment_id: res.payments?.[0]?.reference_number || "",
              paymongo_refund_id: match[1]?.trim(),
              status: match[2]?.trim().toLowerCase() as any,
              amount: parseFloat(match[3]?.replace(/[^\d.]/g, "") || "0"),
              currency: "PHP",
              reason: match[4]?.trim() as any,
              admin_email: match[5]?.trim(),
              notes: "Parsed from reservation audit log",
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
    }

    return { success: true, refunds: [] };
  } catch (err: any) {
    console.error("Error getting refunds:", err);
    return { success: false, refunds: [] };
  }
}

/**
 * Reconcile PayMongo Refund status directly from PayMongo API
 */
export async function reconcilePayMongoRefundStatusAction(reservationId: string, refundId?: string) {
  try {
    await requireAdminOrManager();

    if (!reservationId) {
      return { success: false, error: "Missing reservation ID." };
    }

    const authHeader = getPayMongoAuthHeader();

    // If specific PayMongo refund ID provided, query it directly
    if (refundId && refundId.startsWith("ref_")) {
      const res = await fetch(`https://api.paymongo.com/v1/refunds/${refundId}`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const status = json.data?.attributes?.status;
        if (status) {
          try {
            await supabase
              .from("refunds")
              .update({
                status,
                metadata: json.data.attributes,
                updated_at: new Date().toISOString(),
              })
              .eq("paymongo_refund_id", refundId);
          } catch {}

          return { success: true, status, message: `Reconciliation complete. Refund status is '${status}'.` };
        }
      }
    }

    // Otherwise fetch the reservation's payment and inspect its refunds array
    const { data: resData } = await supabase
      .from("reservations")
      .select("*, payments(*)")
      .eq("id", reservationId)
      .single();

    const payment = Array.isArray(resData?.payments) ? resData.payments[0] : resData?.payments;
    if (payment?.reference_number?.startsWith("pay_")) {
      const payRes = await fetch(`https://api.paymongo.com/v1/payments/${payment.reference_number}`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      });

      if (payRes.ok) {
        const payJson = await payRes.json();
        const refundsList = payJson.data?.attributes?.refunds || [];
        if (refundsList.length > 0) {
          const latestRefund = refundsList[refundsList.length - 1];
          const latestStatus = latestRefund.status || "succeeded";

          try {
            await supabase
              .from("refunds")
              .update({
                status: latestStatus,
                paymongo_refund_id: latestRefund.id,
                updated_at: new Date().toISOString(),
              })
              .eq("reservation_id", reservationId);
          } catch {}

          return {
            success: true,
            status: latestStatus,
            message: `Reconciliation verified with PayMongo: Payment has refund '${latestRefund.id}' with status '${latestStatus}'.`,
          };
        } else {
          return {
            success: true,
            status: "none",
            message: "No refund record found on PayMongo for this payment.",
          };
        }
      }
    }

    return { success: false, error: "Could not find PayMongo refund or payment record for reconciliation." };
  } catch (err: any) {
    return { success: false, error: err.message || "Reconciliation failed." };
  }
}

/**
 * Sends a clean, luxury-themed HTML email to the customer notifying them of their refund.
 */
async function sendRefundNoticeEmail({
  recipientEmail,
  customerName,
  reservationCode,
  serviceName,
  amountRefunded,
  providerRefundId,
  refundReason,
  status,
}: {
  recipientEmail: string;
  customerName: string;
  reservationCode: string;
  serviceName: string;
  amountRefunded: number;
  providerRefundId: string;
  refundReason: string;
  status: string;
}) {
  const siteUrl = getPublicSiteUrl();
  const reasonFormatted = refundReason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Refund Notice - Jbenz Bistro</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 24px; color: #1f2937;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #ede8e1;">
    
    <div style="background: linear-gradient(135deg, #2a060e 0%, #4d0c1b 50%, #3d0a14 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">
        JBENZ <span style="color: #c9a84c;">BISTRO</span>
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #e5d3a1;">
        Payment Refund Confirmation
      </p>
    </div>

    <div style="padding: 28px 24px;">
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #374151;">
        Dear <strong>${customerName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; color: #4b5563;">
        We would like to inform you that a refund for your reservation has been successfully processed through our payment partner, PayMongo.
      </p>

      <div style="background-color: #faf9f6; border: 1px solid #ece6dc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Reservation Code</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; font-family: monospace; color: #8b1327;">${reservationCode}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Service</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Refund Status</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #047857; text-transform: uppercase;">${status}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Refund Transaction ID</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; color: #4b5563;">${providerRefundId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Reason</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #4b5563;">${reasonFormatted}</td>
          </tr>
          <tr style="border-top: 1px dashed #d1c7b7;">
            <td style="padding: 10px 0 0 0; font-weight: 800; color: #111827;">TOTAL REFUNDED</td>
            <td style="padding: 10px 0 0 0; text-align: right; font-weight: 900; color: #047857; font-size: 16px;">₱${amountRefunded.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin: 0 0 20px 0;">
        Depending on your original payment provider (GCash, Maya, or Bank), the refund will reflect in your account within 1 to 5 business days according to the provider's standard settlement turnaround time.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/profile" style="display: inline-block; background-color: #3d0a14; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
          View Account Profile
        </a>
      </div>
    </div>

    <div style="background-color: #f7f5f2; border-top: 1px solid #ede8e1; padding: 16px 24px; text-align: center; font-size: 11px; color: #9ca3af;">
      &copy; ${new Date().getFullYear()} Jbenz Bistro Restobar. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `Payment Refund Notification (₱${amountRefunded.toLocaleString()}) - Jbenz Bistro #${reservationCode}`,
    html,
  });
}
