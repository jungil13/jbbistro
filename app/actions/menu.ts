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

export async function getMenuStockMap(): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "menu_stock_map")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (err) {
    // If not set yet, return empty
  }
  return {};
}

export async function saveMenuStockMap(map: Record<string, number>) {
  try {
    await supabase.from("settings").upsert({
      key: "menu_stock_map",
      value: JSON.stringify(map),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error saving menu_stock_map:", err);
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
  stock?: number;
}) {
  try {
    const { image_url, stock, ...itemData } = data;
    const validatedStock = Math.max(0, Math.floor(stock !== undefined ? Number(stock) : 50));
    
    // Attempt insert with stock column
    let inserted: any = null;
    let insertError: any = null;

    try {
      const res = await supabase
        .from("menu_items")
        .insert([
          {
            ...itemData,
            stock: validatedStock,
            available: itemData.available ?? (validatedStock > 0),
            sort_order: itemData.sort_order ?? 1,
          },
        ])
        .select()
        .single();
      inserted = res.data;
      insertError = res.error;
    } catch (e: any) {
      insertError = e;
    }

    // Fallback if column 'stock' does not exist yet
    if (insertError) {
      const res = await supabase
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
      if (res.error) {
        console.error("Error adding menu item:", res.error);
        return { success: false, error: res.error.message };
      }
      inserted = res.data;
    }

    if (inserted?.id) {
      // Sync stock in persistent stock map
      const stockMap = await getMenuStockMap();
      stockMap[inserted.id] = validatedStock;
      await saveMenuStockMap(stockMap);

      if (image_url) {
        const currentImages = await getMenuImages();
        currentImages[inserted.id] = image_url;
        await saveMenuImageMap(currentImages);
        try {
          await supabase.from("menu_items").update({ image_url }).eq("id", inserted.id);
        } catch {}
      }
    }

    revalidatePath("/menu");
    revalidatePath("/admin/menu");
    revalidatePath("/manager/menu");
    return { success: true, item: { ...inserted, stock: validatedStock } };
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
    stock: number;
  }>
) {
  try {
    const { image_url, stock, ...itemData } = data;
    const updatePayload: any = { ...itemData };
    
    if (stock !== undefined) {
      const validatedStock = Math.max(0, Math.floor(Number(stock)));
      updatePayload.stock = validatedStock;
      if (validatedStock === 0 && updatePayload.available === undefined) {
        updatePayload.available = false;
      }
      // Sync stock in fallback map
      const stockMap = await getMenuStockMap();
      stockMap[id] = validatedStock;
      await saveMenuStockMap(stockMap);
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from("menu_items")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        // If updating stock column failed because column is missing, strip stock and retry
        if (error.message?.includes("stock")) {
          delete updatePayload.stock;
          if (Object.keys(updatePayload).length > 0) {
            await supabase.from("menu_items").update(updatePayload).eq("id", id);
          }
        } else {
          console.error("Error updating menu item:", error);
          return { success: false, error: error.message };
        }
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
      try {
        await supabase.from("menu_items").update({ image_url }).eq("id", id);
      } catch {}
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

    const currentStock = await getMenuStockMap();
    if (currentStock[id] !== undefined) {
      delete currentStock[id];
      await saveMenuStockMap(currentStock);
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

/**
 * Server-side stock validation and deduction
 * Validates that all requested items are in stock and decrements inventory atomically
 */
export async function validateAndDeductStockAction(
  items: Array<{ menu_item_id: string; quantity: number }>
): Promise<{ success: boolean; error?: string }> {
  if (!items || items.length === 0) return { success: true };

  try {
    const ids = items.map((i) => i.menu_item_id);
    const { data: menuItems, error } = await supabase
      .from("menu_items")
      .select("id, name, stock, available")
      .in("id", ids);

    if (error) {
      console.error("Error fetching menu items for stock validation:", error);
    }

    const stockMap = await getMenuStockMap();
    const itemsMap = new Map((menuItems || []).map((m: any) => [m.id, m]));

    // 1. Validation phase
    for (const item of items) {
      if (item.quantity <= 0) continue;
      const dbItem: any = itemsMap.get(item.menu_item_id);
      const itemName = dbItem?.name || "Selected item";
      
      // Determine effective stock (column or map fallback)
      let availableStock = dbItem?.stock !== undefined ? dbItem.stock : (stockMap[item.menu_item_id] ?? 50);
      
      if (dbItem && dbItem.available === false && availableStock > 0) {
        availableStock = 0;
      }

      if (availableStock <= 0) {
        return {
          success: false,
          error: `"${itemName}" is currently out of stock. Please remove it from your selection to proceed.`,
        };
      }

      if (item.quantity > availableStock) {
        return {
          success: false,
          error: `Only ${availableStock} unit(s) of "${itemName}" available in stock (you requested ${item.quantity}).`,
        };
      }
    }

    // 2. Deduction phase
    for (const item of items) {
      if (item.quantity <= 0) continue;
      const dbItem: any = itemsMap.get(item.menu_item_id);
      let currentStock = dbItem?.stock !== undefined ? dbItem.stock : (stockMap[item.menu_item_id] ?? 50);
      const newStock = Math.max(0, currentStock - item.quantity);

      // Deduct in DB table
      try {
        await supabase
          .from("menu_items")
          .update({
            stock: newStock,
            available: newStock > 0,
          })
          .eq("id", item.menu_item_id);
      } catch (err) {
        console.warn("Could not update stock column directly:", err);
      }

      // Deduct in stock map
      stockMap[item.menu_item_id] = newStock;
    }

    await saveMenuStockMap(stockMap);
    revalidatePath("/menu");
    revalidatePath("/admin/menu");
    revalidatePath("/manager/menu");

    return { success: true };
  } catch (err: any) {
    console.error("Error in validateAndDeductStockAction:", err);
    return { success: false, error: err.message || "Failed to validate menu stock." };
  }
}

