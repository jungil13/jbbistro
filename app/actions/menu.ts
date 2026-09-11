"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Initialize Supabase client with the service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getMenuImages(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "menu_images")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (err) {
    // If not set yet, return empty
  }
  return {};
}

export async function saveMenuImageMap(map: Record<string, string>) {
  try {
    await supabase.from("settings").upsert({
      key: "menu_images",
      value: JSON.stringify(map),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error saving menu_images:", err);
  }
}

export async function addMenuItem(data: {
  name: string;
  category: string;
  price: number;
  description?: string;
  available?: boolean;
  sort_order?: number;
  image_url?: string;
}) {
  try {
    const { image_url, ...itemData } = data;
    const { data: inserted, error } = await supabase
      .from("menu_items")
      .insert([
        {
          ...itemData,
          available: itemData.available ?? true,
          sort_order: itemData.sort_order ?? 1,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error adding menu item:", error);
      return { success: false, error: error.message };
    }

    if (image_url && inserted?.id) {
      const currentImages = await getMenuImages();
      currentImages[inserted.id] = image_url;
      await saveMenuImageMap(currentImages);
      // Attempt direct column update if table has image_url
      await supabase.from("menu_items").update({ image_url }).eq("id", inserted.id);
    }

    revalidatePath("/menu");
    revalidatePath("/admin/menu");
    revalidatePath("/manager/menu");
    return { success: true, item: inserted };
  } catch (err: any) {
    console.error("Error in addMenuItem:", err);
    return { success: false, error: err.message };
  }
}

export async function updateMenuItem(
  id: string,
  data: Partial<{
    name: string;
    category: string;
    price: number;
    description: string;
    available: boolean;
    sort_order: number;
    image_url: string;
  }>
) {
  try {
    const { image_url, ...itemData } = data;
    
    if (Object.keys(itemData).length > 0) {
      const { error } = await supabase
        .from("menu_items")
        .update(itemData)
        .eq("id", id);

      if (error) {
        console.error("Error updating menu item:", error);
        return { success: false, error: error.message };
      }
    }

    if (image_url !== undefined) {
      const currentImages = await getMenuImages();
      if (image_url) {
        currentImages[id] = image_url;
      } else {
        delete currentImages[id];
      }
      await saveMenuImageMap(currentImages);
      // Also attempt direct column update
      await supabase.from("menu_items").update({ image_url }).eq("id", id);
    }

    revalidatePath("/menu");
    revalidatePath("/admin/menu");
    revalidatePath("/manager/menu");
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

    const currentImages = await getMenuImages();
    if (currentImages[id]) {
      delete currentImages[id];
      await saveMenuImageMap(currentImages);
    }

    revalidatePath("/menu");
    revalidatePath("/admin/menu");
    revalidatePath("/manager/menu");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteMenuItem:", err);
    return { success: false, error: err.message };
  }
}
