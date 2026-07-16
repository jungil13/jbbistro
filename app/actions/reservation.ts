"use server";

import { createClient } from "@supabase/supabase-js";

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

    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteReservationAction:", err);
    return { success: false, error: err.message };
  }
}
