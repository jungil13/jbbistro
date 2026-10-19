"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendEmail, getPublicSiteUrl } from "../../lib/email";

// Initialize Supabase client with the service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iqqgysfbtqcgkuwvssqh.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxcWd5c2ZidHFjZ2t1d3Zzc3FoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkyMjk1MSwiZXhwIjoyMDk5NDk4OTUxfQ.zDUyaKC0Q_VHAnFMF9wghlUfAZSnrIjmND5YqglMl7w"
);

export async function deleteReservationAction(id: string) {
  try {
    // Delete payments
    const { error: paymentError } = await supabase.from("payments").delete().eq("reservation_id", id);
    if (paymentError && paymentError.code !== 'PGRST116') {
      console.warn("Payment delete failed, proceeding to delete reservation.", paymentError);
    }

    // Delete reservation menu items
    await supabase.from("reservation_menu").delete().eq("reservation_id", id);
    
    // Delete the reservation itself
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    
    if (error) {
      console.error("Error deleting reservation:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/reservations");
    revalidatePath("/manager/reservations");
    revalidatePath("/admin");
    revalidatePath("/manager");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteReservationAction:", err);
    return { success: false, error: err.message };
  }
}

export async function createWalkInSaleAction(data: {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  service_id?: string | null;
  total_amount: number;
  notes?: string;
  payment_method: "cash" | "gcash";
  payment_reference?: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
  }>;
}) {
  try {
    const walkCode = "WALK-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const timeStart = now.toTimeString().split(" ")[0].substring(0, 5);

    // 1. Insert confirmed reservation record
    const { data: res, error: resErr } = await supabase
      .from("reservations")
      .insert([
        {
          reservation_code: walkCode,
          customer_name: data.customer_name || "Walk-in Guest",
          customer_email: data.customer_email?.trim() || null,
          customer_phone: data.customer_phone || "",
          service_id: data.service_id || null,
          date: todayStr,
          time_start: timeStart,
          guests: 1,
          status: "confirmed",
          total_amount: data.total_amount,
          notes: `[Walk-in Order] ${data.notes || ""}`.trim(),
        },
      ])
      .select()
      .single();

    if (resErr || !res) {
      console.error("Error creating walk-in reservation:", resErr);
      return { success: false, error: resErr?.message || "Failed to create reservation" };
    }

    // 2. Insert verified payment
    const { error: payErr } = await supabase.from("payments").insert([
      {
        reservation_id: res.id,
        method: data.payment_method,
        reference_number: data.payment_reference || `WALK-${Date.now()}`,
        amount: data.total_amount,
        status: "verified",
      },
    ]);

    if (payErr) {
      console.warn("Payment insert error for walk-in:", payErr);
    }

    // 3. Insert reservation menu items
    if (data.items && data.items.length > 0) {
      const menuRows = data.items.map((it) => ({
        reservation_id: res.id,
        menu_item_id: it.menu_item_id,
        quantity: it.quantity,
      }));
      const { error: menuErr } = await supabase.from("reservation_menu").insert(menuRows);
      if (menuErr) {
        console.warn("Reservation menu insert error for walk-in:", menuErr);
      }
    }

    revalidatePath("/admin");
    revalidatePath("/manager");
    revalidatePath("/admin/reservations");
    revalidatePath("/manager/reservations");

    // Notify admin/staff of walk-in sale
    await supabase.from("notifications").insert([{
      user_id: null,
      type: "payment",
      title: "Walk-in Sale Recorded",
      message: `Walk-in order ${res.reservation_code} for ${data.customer_name || "Guest"} — ₱${data.total_amount.toLocaleString()} (${data.payment_method.toUpperCase()}).`,
      read: false,
    }]);

    return {
      success: true,
      reservationId: res.id,
      reservationCode: res.reservation_code,
    };
  } catch (err: any) {
    console.error("Error in createWalkInSaleAction:", err);
    return { success: false, error: err.message };
  }
}

export async function updateReservationStatusAction(id: string, status: string) {
  try {
    // Fetch reservation for notification context + email
    const { data: res } = await supabase
      .from("reservations")
      .select("reservation_code, customer_name, customer_id, customer_email, date, time_start, services ( name )")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Error updating reservation status:", error);
      return { success: false, error: error.message };
    }

    // Insert admin notification (user_id: null = broadcast to all admin/staff)
    const statusLabel = status === "confirmed" ? "Confirmed" : status === "cancelled" ? "Cancelled" : status.charAt(0).toUpperCase() + status.slice(1);
    await supabase.from("notifications").insert([{
      user_id: null,
      type: status === "confirmed" ? "success" : status === "cancelled" ? "warning" : "info",
      title: `Reservation ${statusLabel}`,
      message: `Reservation ${res?.reservation_code ?? id} for ${res?.customer_name ?? "customer"} has been ${status}.`,
      read: false,
    }]);

    // Notify the customer too (if they have an account)
    if (res?.customer_id) {
      await supabase.from("notifications").insert([{
        user_id: res.customer_id,
        type: status === "confirmed" ? "success" : status === "cancelled" ? "warning" : "info",
        title: `Your reservation is ${statusLabel}`,
        message: `Your reservation ${res.reservation_code} has been ${status} by the restaurant.`,
        read: false,
      }]);
    }

    // Send status update email to customer if email is available
    const recipientEmail = res?.customer_email;
    if (recipientEmail) {
      const resCode = res?.reservation_code ?? id.slice(0, 8).toUpperCase();
      const customerName = res?.customer_name ?? "Valued Guest";
      const serviceName = (res?.services as any)?.name ?? "your reservation";
      const bookingDate = res?.date ?? "";
      const bookingTime = res?.time_start ?? "";
      const siteUrl = getPublicSiteUrl();

      const statusColors: Record<string, string> = {
        confirmed: "#16a34a",
        cancelled: "#dc2626",
        pending: "#d97706",
        completed: "#2563eb",
      };
      const statusColor = statusColors[status] ?? "#6b7280";
      const statusBg: Record<string, string> = {
        confirmed: "#f0fdf4",
        cancelled: "#fef2f2",
        pending: "#fffbeb",
        completed: "#eff6ff",
      };
      const statusBackground = statusBg[status] ?? "#f9fafb";
      const statusMessages: Record<string, string> = {
        confirmed: "Great news! Your reservation has been confirmed by our team. We look forward to welcoming you!",
        cancelled: "We regret to inform you that your reservation has been cancelled. Please contact us if you have any questions.",
        pending: "Your reservation is currently under review. We will notify you once it has been confirmed.",
        completed: "Thank you for visiting Jbenz Bistro! We hope you had a wonderful experience.",
      };
      const statusMessage = statusMessages[status] ?? `Your reservation status has been updated to ${statusLabel}.`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reservation Update - Jbenz Bistro</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 24px; color: #1f2937;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #ede8e1;">
    <div style="background: linear-gradient(135deg, #2a060e 0%, #4d0c1b 50%, #3d0a14 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">JBENZ <span style="color: #c9a84c;">BISTRO</span></h1>
      <p style="margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #e5d3a1;">Reservation Status Update</p>
    </div>
    <div style="padding: 28px 24px;">
      <p style="font-size: 15px; margin: 0 0 12px 0; color: #374151;">Dear <strong>${customerName}</strong>,</p>
      <div style="background-color: ${statusBackground}; border: 1.5px solid ${statusColor}40; border-radius: 12px; padding: 16px 20px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">Reservation Status</p>
        <p style="margin: 0; font-size: 22px; font-weight: 800; color: ${statusColor}; text-transform: uppercase; letter-spacing: 1px;">${statusLabel}</p>
      </div>
      <p style="font-size: 14px; line-height: 1.7; color: #4b5563; margin: 0 0 20px 0;">${statusMessage}</p>
      <div style="background-color: #faf9f6; border: 1px solid #ece6dc; border-radius: 12px; padding: 18px 20px; font-size: 13px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 5px 0; color: #6b7280;">Reservation Code</td><td style="padding: 5px 0; text-align: right; font-weight: 800; font-family: monospace; color: #8b1327;">${resCode}</td></tr>
          <tr><td style="padding: 5px 0; color: #6b7280;">Service</td><td style="padding: 5px 0; text-align: right; font-weight: 700; color: #111827;">${serviceName}</td></tr>
          ${bookingDate ? `<tr><td style="padding: 5px 0; color: #6b7280;">Date</td><td style="padding: 5px 0; text-align: right; font-weight: 600; color: #111827;">${bookingDate}</td></tr>` : ""}
          ${bookingTime ? `<tr><td style="padding: 5px 0; color: #6b7280;">Time</td><td style="padding: 5px 0; text-align: right; font-weight: 600; color: #111827;">${bookingTime}</td></tr>` : ""}
        </table>
      </div>
      <div style="text-align: center; margin: 24px 0 8px 0;">
        <a href="${siteUrl}/profile" style="display: inline-block; background-color: #3d0a14; color: #ffffff; text-decoration: none; padding: 13px 26px; border-radius: 10px; font-weight: 700; font-size: 14px;">View in My Profile</a>
      </div>
    </div>
    <div style="background-color: #f3f0ea; padding: 18px; text-align: center; border-top: 1px solid #e5dfd5; font-size: 12px; color: #6b7280;">
      <p style="margin: 0 0 4px 0; font-weight: 700; color: #3d0a14;">Jbenz Bistro Restobar</p>
      <p style="margin: 0;">Questions? Contact us directly or visit our website.</p>
    </div>
  </div>
</body>
</html>`;

      try {
        await sendEmail({
          to: recipientEmail,
          subject: `Reservation ${statusLabel} - Jbenz Bistro (${resCode})`,
          html: emailHtml,
        });
      } catch (emailErr) {
        console.warn("[Email] Failed to send status update email:", emailErr);
      }
    }

    revalidatePath("/admin/reservations");
    revalidatePath("/manager/reservations");
    revalidatePath("/admin");
    revalidatePath("/manager");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateReservationStatusAction:", err);
    return { success: false, error: err.message };
  }
}

