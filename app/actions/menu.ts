"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Initialize Supabase client with the service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function addMenuItem(data: {
  name: string;
  category: string;
  price: number;
  description?: string;
  available?: boolean;
  sort_order?: number;
}) {
  try {
    const { error } = await supabase.from("menu_items").insert([{
      ...data,
      available: data.available ?? true,
      sort_order: data.sort_order ?? 1,
    }]);
    
    if (error) {
      console.error("Error adding menu item:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/menu");
    return { success: true };
  } catch (err: any) {
    console.error("Error in addMenuItem:", err);
    return { success: false, error: err.message };
  }
}

export async function updateMenuItem(id: string, data: Partial<{
  name: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
  sort_order: number;
}>) {
  try {
    const { error } = await supabase.from("menu_items").update(data).eq("id", id);
    
    if (error) {
      console.error("Error updating menu item:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/menu");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateMenuItem:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteMenuItem(id: string) {
  try {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    
    if (error) {
      console.error("Error deleting menu item:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/menu");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteMenuItem:", err);
    return { success: false, error: err.message };
  }
}
