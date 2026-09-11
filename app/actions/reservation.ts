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
          customer_email: data.customer_email || "walkin@jbenzbistro.local",
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
