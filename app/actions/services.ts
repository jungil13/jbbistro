"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function saveServiceAction(data: {
  id?: string;
  type: string;
  name: string;
  category: string;
  hourly_rate: number;
  capacity: number;
  status: "available" | "occupied" | "maintenance";
  description?: string;
}) {
  try {
    if (data.id) {
      const { error } = await supabase
        .from("services")
        .update({
          type: data.type,
          name: data.name,
          category: data.category,
          hourly_rate: data.hourly_rate,
          capacity: data.capacity,
          status: data.status,
          description: data.description,
        })
        .eq("id", data.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("services").insert([
        {
          type: data.type,
          name: data.name,
          category: data.category,
          hourly_rate: data.hourly_rate,
          capacity: data.capacity,
          status: data.status,
          description: data.description,
        },
      ]);

      if (error) throw error;
    }

    revalidatePath("/admin/services");
    revalidatePath("/manager/services");
    return { success: true };
  } catch (err: any) {
    console.error("Error saving service:", err);
    return { success: false, error: err.message };
  }
}
