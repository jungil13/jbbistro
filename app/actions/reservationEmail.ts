"use server";

import { createClient } from "@supabase/supabase-js";
import { formatDate, formatTime, formatDateTime } from "../../lib/dateUtils";
import { sendEmail } from "../../lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iqqgysfbtqcgkuwvssqh.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxcWd5c2ZidHFjZ2t1d3Zzc3FoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkyMjk1MSwiZXhwIjoyMDk5NDk4OTUxfQ.zDUyaKC0Q_VHAnFMF9wghlUfAZSnrIjmND5YqglMl7w"
);

export interface ReservationEmailPayload {
  reservationId: string;
}

export async function sendReservationConfirmationEmailAction(reservationId: string) {
  try {
    if (!reservationId) return { success: false, error: "Missing reservation ID" };

    // Fetch complete reservation details
    const { data: res, error } = await supabase
      .from("reservations")
      .select(`
        *,
        services ( id, name, hourly_rate, type, capacity ),
        reservation_menu (
          quantity,
          menu_items ( id, name, price, category )
        ),
        payments ( id, amount, method, status, reference_number, created_at )
      `)
      .eq("id", reservationId)
      .single();

    if (error || !res) {
      console.error("Reservation not found for email:", error);
      return { success: false, error: "Reservation not found" };
    }

    const recipientEmail = res.customer_email || res.email;
    const customerName = res.customer_name || res.name || "Valued Guest";
    const reservationCode = res.reservation_code || reservationId.slice(0, 8).toUpperCase();
    const serviceName = res.services?.name || "Bistro Reservation";
    const dateFormatted = formatDate(res.date);
    const timeFormatted = formatTime(res.time_start || "");
    const grandTotal = Number(res.total_amount || 0);
    const payment = Array.isArray(res.payments) ? res.payments[0] : res.payments;
    const paymentMethod = payment?.method ? payment.method.toUpperCase() : "CASH / ON ARRIVAL";
    const refNo = payment?.reference_number || "—";
    const rawSiteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const siteUrl = rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;
    const receiptLink = `${siteUrl}/receipt/${res.id}`;

    // Format pre-ordered items list
    let menuItemsHtml = "";
    if (res.reservation_menu && res.reservation_menu.length > 0) {
      menuItemsHtml = `
        <div style="margin-top: 16px; margin-bottom: 16px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
          <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; margin: 0 0 8px 0;">Pre-ordered Menu Items</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            ${res.reservation_menu
              .map(
                (rm: any) => `
              <tr>
                <td style="padding: 4px 0; color: #374151;">
                  ${rm.quantity > 1 ? `<strong style="color: #c9a84c; margin-right: 4px;">${rm.quantity}x</strong>` : ""}
                  ${rm.menu_items?.name || "Item"}
                </td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #111827;">
                  ₱${Number((rm.menu_items?.price ?? 0) * rm.quantity).toLocaleString()}
                </td>
              </tr>
            `
              )
              .join("")}
          </table>
        </div>
      `;
    }

    // HTML Email Template matching Jbenz Bistro luxury theme
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Confirmation &amp; Receipt - Jbenz Bistro</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 24px; color: #1f2937;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #ede8e1;">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #2a060e 0%, #4d0c1b 50%, #3d0a14 100%); padding: 36px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">
        JBENZ <span style="color: #c9a84c;">BISTRO</span>
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #e5d3a1;">
        Fine Dining · Karaoke Suites · Billiards
      </p>
      <div style="display: inline-block; margin-top: 18px; padding: 6px 16px; background-color: rgba(201,168,76,0.18); border: 1px solid #c9a84c; border-radius: 20px; font-size: 11px; font-weight: 700; color: #c9a84c; text-transform: uppercase; letter-spacing: 1.5px;">
        Official Booking Confirmation &amp; Receipt
      </div>
    </div>

    <!-- Body Content -->
    <div style="padding: 28px 24px;">
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #374151;">
        Dear <strong>${customerName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #4b5563;">
        Thank you for choosing Jbenz Bistro! Your reservation has been successfully received and recorded. Below is your complete booking summary and official receipt details.
      </p>

      <!-- Receipt Card -->
      <div style="background-color: #faf9f6; border: 1px solid #ece6dc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Reservation Code</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; font-family: monospace; color: #8b1327; font-size: 14px;">${reservationCode}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Service / Suite</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Date &amp; Time</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${dateFormatted} at ${timeFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Party Size</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${res.guests} Guest(s)</td>
          </tr>
        </table>

        ${menuItemsHtml}

        <div style="border-top: 2px dashed #d1c7b7; margin-top: 14px; padding-top: 14px;">
          <table style="width: 100%; font-size: 15px;">
            <tr>
              <td style="font-weight: 800; color: #111827;">TOTAL AMOUNT DUE</td>
              <td style="text-align: right; font-weight: 900; color: #8b1327; font-size: 18px;">₱${grandTotal.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #ede8e1; font-size: 12px; color: #6b7280;">
          <div><strong>Payment Method:</strong> ${paymentMethod}</div>
          ${refNo !== "—" ? `<div><strong>Reference No:</strong> ${refNo}</div>` : ""}
          <div><strong>Booking Status:</strong> ${res.status || "PENDING"}</div>
        </div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 30px 0 10px 0;">
        <a href="${receiptLink}" style="display: inline-block; background-color: #3d0a14; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(61,10,20,0.25);">
          View &amp; Print Official Receipt Online
        </a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 16px;">
        You can also view this booking anytime in your profile dashboard.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f3f0ea; padding: 20px; text-align: center; border-top: 1px solid #e5dfd5; font-size: 12px; color: #6b7280;">
      <p style="margin: 0 0 6px 0; font-weight: 700; color: #3d0a14;">Jbenz Bistro Restobar</p>
      <p style="margin: 0; line-height: 1.5;">
        Need to change your reservation or have questions? Contact us directly or visit our website.
      </p>
      <p style="margin: 12px 0 0 0; font-size: 10px; color: #9ca3af;">
        Generated on ${formatDateTime(new Date().toISOString())}
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Send via Supabase custom SMTP
    if (recipientEmail) {
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: `Booking Confirmed & Official Receipt - Jbenz Bistro (${reservationCode})`,
        html: emailHtml,
      });
      if (!emailResult.success) {
        console.error(`[Email] Failed to send email to ${recipientEmail}:`, emailResult.error);
      }
    }

    // Also record an in-app receipt notification for the user
    if (res.user_id || res.customer_id) {
      const targetUserId = res.user_id || res.customer_id;
      await supabase.from("notifications").insert([
        {
          user_id: targetUserId,
          type: "receipt",
          title: `Official Receipt - #${reservationCode}`,
          message: `Your booking for ${serviceName} on ${dateFormatted} at ${timeFormatted} is confirmed. Total: ₱${grandTotal.toLocaleString()}. Official receipt generated.`,
          read: false,
        },
      ]);
    }

    console.log(`[Email] Reservation confirmation processed for ${recipientEmail || "Guest"} (#${reservationCode})`);
    return { success: true, email: recipientEmail, reservationCode };
  } catch (err: any) {
    console.error("Error in sendReservationConfirmationEmailAction:", err);
    return { success: false, error: err.message };
  }
}

export async function sendTestEmailAction(targetEmail?: string) {
  try {
    const to = (targetEmail || process.env.SMTP_USER || "bernardrubia@gmail.com").trim();
    const res = await sendEmail({
      to,
      subject: "🧪 Test Email Notification - Jbenz Bistro",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 24px; color: #1f2937;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ede8e1; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #2a060e 0%, #4d0c1b 50%, #3d0a14 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">
                JBENZ <span style="color: #c9a84c;">BISTRO</span>
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #e5d3a1;">
                Email System Verification
              </p>
            </div>
            <div style="padding: 24px;">
              <h3 style="margin-top: 0; color: #16a34a; font-size: 16px;">✅ Email System is Active &amp; Ready</h3>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
                This test message confirms that your Gmail SMTP notifications are operating seamlessly on Vercel and local environments.
              </p>
              <div style="background-color: #faf9f6; border: 1px solid #e5dfd5; border-radius: 10px; padding: 12px 16px; margin: 18px 0; font-size: 12px; color: #6b7280;">
                <p style="margin: 0;"><strong>Recipient:</strong> ${to}</p>
                <p style="margin: 4px 0 0 0;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">Jbenz Bistro Automated Notification Service</p>
            </div>
          </div>
        </div>
      `,
    });
    return res;
  } catch (err: any) {
    console.error("Test email failed:", err);
    return { success: false, error: err.message };
  }
}
