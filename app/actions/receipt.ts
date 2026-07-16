"use server";
import { createClient } from "@supabase/supabase-js";

export async function getReceiptData(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      services(name, type),
      payments(method, reference_number, status, receipt_url),
      reservation_menu(
        quantity,
        menu_items(name, price, category)
      )
    `)
    .eq("id", id)
    .single();


  if (error) {
    console.error("Error fetching receipt:", error);
    return null;
  }
  return data;
}
