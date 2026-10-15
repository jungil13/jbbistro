"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Initialize Supabase client with the service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    // Fetch reservation for notification context
    const { data: res } = await supabase
      .from("reservations")
      .select("reservation_code, customer_name, customer_id")
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
    const statusLabel = status === "confirmed" ? "Confirmed" : status === "cancelled" ? "Cancelled" : status;
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

