"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AnnouncementItem {
  id: string;
  type: "announcement" | "promotion";
  title: string;
  badge?: string | null;
  description?: string | null;
  image_url?: string | null;
  validity?: string | null;
  link_url?: string | null;
  link_text?: string | null;
  is_active: boolean;
  show_banner: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_ITEMS: AnnouncementItem[] = [
  {
    id: "default-announcement-1",
    type: "announcement",
    title: "Special Weekend Announcement",
    badge: "Notice",
    description: "Special Promo: 20% Off All VIP Karaoke Suites this Weekend! Free Pulutan Platter with every booking.",
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
    validity: "This Weekend Only",
    link_url: "/reserve",
    link_text: "View Announcement",
    is_active: true,
    show_banner: true,
    sort_order: 1,
  },
  {
    id: "default-promo-1",
    type: "promotion",
    title: "Weekend VIP Karaoke & Pulutan Fiesta",
    badge: "Exclusive Promo",
    description: "Book any VIP Karaoke Suite or Dining Table this Friday through Sunday and enjoy 20% off your booking, plus a complimentary signature Pulutan Platter and drinks on the house!",
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
    validity: "Every Fri - Sun • 5:00 PM to Midnight",
    link_url: "/reserve",
    link_text: "Claim This Offer",
    is_active: true,
    show_banner: false,
    sort_order: 2,
  },
];

// Helper fallback sync for zero-downtime before Supabase SQL migration is executed
async function getFallbackAnnouncements(): Promise<AnnouncementItem[]> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "announcements_data")
      .single();

    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_ITEMS;
}

async function saveFallbackAnnouncements(items: AnnouncementItem[]) {
  try {
    await supabase.from("settings").upsert({
      key: "announcements_data",
      value: JSON.stringify(items),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error saving fallback announcements:", e);
  }
}

// Sync banner to legacy settings so legacy components get instant real-time notifications
async function syncLegacyBannerSettings(items: AnnouncementItem[]) {
  try {
    const activeBanner = items.find((i) => i.is_active && i.show_banner);
    const activePromo = items.find((i) => i.is_active && i.type === "promotion");

    const updates = [];
    if (activeBanner) {
      updates.push(
        supabase.from("settings").upsert({
          key: "promo_banner_text",
          value: activeBanner.description || activeBanner.title,
          updated_at: new Date().toISOString(),
        }),
        supabase.from("settings").upsert({
          key: "promo_banner_enabled",
          value: "true",
          updated_at: new Date().toISOString(),
        })
      );
    } else {
      updates.push(
        supabase.from("settings").upsert({
          key: "promo_banner_enabled",
          value: "false",
          updated_at: new Date().toISOString(),
        })
      );
    }

    if (activePromo) {
      updates.push(
        supabase.from("settings").upsert({
          key: "promo_enabled",
          value: "true",
          updated_at: new Date().toISOString(),
        }),
        supabase.from("settings").upsert({
          key: "promo_title",
          value: activePromo.title,
          updated_at: new Date().toISOString(),
        }),
        supabase.from("settings").upsert({
          key: "promo_badge",
          value: activePromo.badge || "Exclusive Promo",
          updated_at: new Date().toISOString(),
        }),
        supabase.from("settings").upsert({
          key: "promo_description",
          value: activePromo.description || "",
          updated_at: new Date().toISOString(),
        }),
        supabase.from("settings").upsert({
          key: "promo_validity",
          value: activePromo.validity || "",
          updated_at: new Date().toISOString(),
        }),
        supabase.from("settings").upsert({
          key: "promo_image",
          value: activePromo.image_url || "",
          updated_at: new Date().toISOString(),
        })
      );
    }

    await Promise.all(updates);
  } catch (e) {
    // Non-blocking sync
  }
}

export async function getAnnouncements(): Promise<{
  success: boolean;
  data: AnnouncementItem[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && data) {
      if (data.length === 0) {
        // If table exists but empty, check fallback or seed
        const fallback = await getFallbackAnnouncements();
        return { success: true, data: fallback };
      }
      return { success: true, data };
    }

    // If table doesn't exist yet (PGRST205), return fallback
    const fallback = await getFallbackAnnouncements();
    return { success: true, data: fallback };
  } catch (err: any) {
    console.error("Error in getAnnouncements:", err);
    const fallback = await getFallbackAnnouncements();
    return { success: true, data: fallback };
  }
}

export async function addAnnouncement(item: Omit<AnnouncementItem, "id" | "created_at" | "updated_at">) {
  try {
    const { data: inserted, error } = await supabase
      .from("announcements")
      .insert([
        {
          ...item,
          is_active: item.is_active ?? true,
          show_banner: item.show_banner ?? false,
          sort_order: item.sort_order ?? 0,
        },
      ])
      .select()
      .single();

    // Also update fallback cache and legacy settings
    const current = await getFallbackAnnouncements();
    const newItem: AnnouncementItem = inserted || {
      ...item,
      id: "announcement-" + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newItem, ...current];
    await saveFallbackAnnouncements(updated);
    await syncLegacyBannerSettings(updated);

    revalidatePath("/announcements");
    revalidatePath("/admin/announcements");
    revalidatePath("/manager/announcements");
    revalidatePath("/");

    return { success: true, item: newItem };
  } catch (err: any) {
    console.error("Error in addAnnouncement:", err);
    return { success: false, error: err.message };
  }
}

export async function updateAnnouncement(id: string, updates: Partial<AnnouncementItem>) {
  try {
    const { error } = await supabase
      .from("announcements")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Sync fallback
    const current = await getFallbackAnnouncements();
    const index = current.findIndex((i) => i.id === id);
    if (index !== -1) {
      current[index] = { ...current[index], ...updates, updated_at: new Date().toISOString() };
    } else {
      current.push({ id, ...updates } as AnnouncementItem);
    }
    await saveFallbackAnnouncements(current);
    await syncLegacyBannerSettings(current);

    revalidatePath("/announcements");
    revalidatePath("/admin/announcements");
    revalidatePath("/manager/announcements");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateAnnouncement:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    await supabase.from("announcements").delete().eq("id", id);

    // Sync fallback
    const current = await getFallbackAnnouncements();
    const updated = current.filter((i) => i.id !== id);
    await saveFallbackAnnouncements(updated);
    await syncLegacyBannerSettings(updated);

    revalidatePath("/announcements");
    revalidatePath("/admin/announcements");
    revalidatePath("/manager/announcements");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteAnnouncement:", err);
    return { success: false, error: err.message };
  }
}

export async function toggleAnnouncementActive(id: string, is_active: boolean) {
  return updateAnnouncement(id, { is_active });
}

export async function toggleAnnouncementBanner(id: string, show_banner: boolean) {
  return updateAnnouncement(id, { show_banner });
}
