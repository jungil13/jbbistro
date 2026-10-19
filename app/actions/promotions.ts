"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getManilaDateTime } from "@/lib/dateUtils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ==========================================
// TYPES & INTERFACES
// ==========================================

export type PromotionType =
  | "percentage"
  | "fixed_amount"
  | "bundle"
  | "happy_hour"
  | "birthday";

export type PromotionStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "expired"
  | "inactive";

export interface BundleItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  original_price: number;
}

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  description: string;
  terms?: string;
  image_url?: string;
  is_active: boolean;
  status: PromotionStatus;
  start_date?: string | null; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  discount_percent: number; // 0 - 100
  discount_amount: number; // e.g. 100 for ₱100 off
  min_spend: number; // qualifying minimum order amount
  bundle_price: number; // e.g. ₱999
  bundle_items: BundleItem[];
  eligible_menu_item_ids: string[];
  eligible_categories: string[];
  applicable_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  start_time?: string | null; // "15:00"
  end_time?: string | null; // "18:00"
  birthday_reward_item_id?: string | null;
  birthday_reward_name?: string | null;
  birthday_window_days: number; // e.g. 7 days or birthday month
  max_total_redemptions?: number | null;
  max_per_customer: number;
  current_redemptions_count: number;
  allow_stacking: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PromotionRedemptionRecord {
  id: string;
  promotion_id: string;
  promotion_name: string;
  promotion_type: PromotionType;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  order_id?: string | null;
  discount_amount: number;
  reward_details?: any;
  redeemed_at: string;
  processed_by?: string;
  verified_birthday?: boolean;
}

export interface PromotionClaimRecord {
  id: string;
  promotion_id: string;
  promotion_title: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  discount_percent: number;
  discount_amount: number;
  status: "pending" | "approved" | "rejected" | "used";
  reservation_id?: string | null;
  notes?: string | null;
  claimed_at: string;
  reviewed_at?: string;
  used_at?: string;
  updated_at?: string;
}

// Computes real-time dynamic promotion status
function computePromotionStatus(promo: Promotion): PromotionStatus {
  if (!promo.is_active) return "inactive";
  if (promo.status === "draft") return "draft";

  const { currentDateStr } = getManilaDateTime();

  if (promo.end_date && promo.end_date < currentDateStr) {
    return "expired";
  }
  if (promo.start_date && promo.start_date > currentDateStr) {
    return "scheduled";
  }
  if (promo.max_total_redemptions && promo.current_redemptions_count >= promo.max_total_redemptions) {
    return "expired";
  }

  return "active";
}

// ==========================================
// DEFAULT SEED PROMOTIONS
// ==========================================

const DEFAULT_PROMOTIONS: Promotion[] = [
  {
    id: "promo-pct-1",
    name: "10% Off All Orders Over ₱1,000",
    type: "percentage",
    description: "Enjoy a 10% discount on your entire food & drinks bill when your reservation or order subtotal reaches ₱1,000.",
    terms: "Valid on all dining and karaoke reservations with a qualifying subtotal of ₱1,000 or higher.",
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80",
    is_active: true,
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    discount_percent: 10,
    discount_amount: 0,
    min_spend: 1000,
    bundle_price: 0,
    bundle_items: [],
    eligible_menu_item_ids: [],
    eligible_categories: [],
    applicable_days: [0, 1, 2, 3, 4, 5, 6],
    start_time: null,
    end_time: null,
    birthday_reward_item_id: null,
    birthday_reward_name: null,
    birthday_window_days: 7,
    max_total_redemptions: null,
    max_per_customer: 5,
    current_redemptions_count: 8,
    allow_stacking: false,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo-fixed-1",
    name: "₱100 Off Bistro Mega Order",
    type: "fixed_amount",
    description: "Get an instant ₱100 deduction when your order reaches at least ₱800.",
    terms: "Minimum spend of ₱800 required. Limited to one voucher redemption per visit.",
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
    is_active: true,
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    discount_percent: 0,
    discount_amount: 100,
    min_spend: 800,
    bundle_price: 0,
    bundle_items: [],
    eligible_menu_item_ids: [],
    eligible_categories: [],
    applicable_days: [0, 1, 2, 3, 4, 5, 6],
    start_time: null,
    end_time: null,
    birthday_reward_item_id: null,
    birthday_reward_name: null,
    birthday_window_days: 7,
    max_total_redemptions: 500,
    max_per_customer: 3,
    current_redemptions_count: 14,
    allow_stacking: false,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo-bundle-1",
    name: "Barkada Meal Deal for ₱599",
    type: "bundle",
    description: "The ultimate gathering feast! Includes 1x Red Horse 1L Tawer, 2x Sizzling Pork Sisig, 2x Tempura, and 1x Crispy Kropek/Fries. Save ₱130!",
    terms: "Available for dine-in and karaoke suites. Subject to menu item inventory availability. All items in the bundle will be prepared together.",
    image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
    is_active: true,
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    discount_percent: 0,
    discount_amount: 130,
    min_spend: 0,
    bundle_price: 599,
    bundle_items: [
      {
        menu_item_id: "67cbcb8c-e977-4644-9d78-c4812d87c428",
        name: "Red Horse 1L (tawer)",
        quantity: 1,
        original_price: 410,
      },
      {
        menu_item_id: "b6100460-3b96-430a-a2a1-4fe59bacba8f",
        name: "Pork Sisig",
        quantity: 2,
        original_price: 80,
      },
      {
        menu_item_id: "75726587-4b17-4b05-b839-f4421c84a7f8",
        name: "Tempura",
        quantity: 2,
        original_price: 40,
      },
      {
        menu_item_id: "41e64b61-55ea-4d54-9f23-648c9888d036",
        name: "Kropek / Fries",
        quantity: 1,
        original_price: 39,
      },
    ],
    eligible_menu_item_ids: [],
    eligible_categories: [],
    applicable_days: [0, 1, 2, 3, 4, 5, 6],
    start_time: null,
    end_time: null,
    birthday_reward_item_id: null,
    birthday_reward_name: null,
    birthday_window_days: 7,
    max_total_redemptions: null,
    max_per_customer: 2,
    current_redemptions_count: 22,
    allow_stacking: false,
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo-hh-1",
    name: "Happy Hour: 20% Off Drinks & Pulutan",
    type: "happy_hour",
    description: "Unwind after work! Get 20% off all beverages and pulutan items between 3:00 PM and 6:00 PM, Monday through Friday (Asia/Manila time).",
    terms: "Automatically active between 15:00 and 18:00 (Philippine Standard Time) on weekdays. Discount applies strictly to eligible beverages and pulutan categories.",
    image_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80",
    is_active: true,
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    discount_percent: 20,
    discount_amount: 0,
    min_spend: 0,
    bundle_price: 0,
    bundle_items: [],
    eligible_menu_item_ids: [],
    eligible_categories: ["Beverages", "Pulutan", "Also Available"],
    applicable_days: [1, 2, 3, 4, 5], // Monday through Friday
    start_time: "15:00",
    end_time: "18:00",
    birthday_reward_item_id: null,
    birthday_reward_name: null,
    birthday_window_days: 7,
    max_total_redemptions: null,
    max_per_customer: 10,
    current_redemptions_count: 31,
    allow_stacking: false,
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo-bday-1",
    name: "Free Birthday Special Treat",
    type: "birthday",
    description: "Celebrate your special day with JBENZ Bistro! Enjoy a complimentary signature treat (Kropek / Fries or Leche Flan) on us during your birthday month.",
    terms: "Must be a registered member with verified Date of Birth, or present a valid government ID to staff upon arrival. Limited to one redemption per customer per calendar year.",
    image_url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200&q=80",
    is_active: true,
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    discount_percent: 0,
    discount_amount: 39,
    min_spend: 300,
    bundle_price: 0,
    bundle_items: [],
    eligible_menu_item_ids: [],
    eligible_categories: [],
    applicable_days: [0, 1, 2, 3, 4, 5, 6],
    start_time: null,
    end_time: null,
    birthday_reward_item_id: "41e64b61-55ea-4d54-9f23-648c9888d036",
    birthday_reward_name: "Complimentary Kropek / Fries Treat",
    birthday_window_days: 15, // within 15 days of birthday
    max_total_redemptions: null,
    max_per_customer: 1, // Strictly 1 per year
    current_redemptions_count: 5,
    allow_stacking: false,
    sort_order: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ==========================================
// FALLBACK CACHE & PERSISTENCE HELPERS
// ==========================================

async function getFallbackPromotions(): Promise<Promotion[]> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "promotions_system_data")
      .single();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_PROMOTIONS;
}

async function saveFallbackPromotions(promos: Promotion[]) {
  try {
    await supabase.from("settings").upsert({
      key: "promotions_system_data",
      value: JSON.stringify(promos),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error saving fallback promotions:", e);
  }
}

async function getFallbackRedemptions(): Promise<PromotionRedemptionRecord[]> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "promotion_redemptions_data")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

async function saveFallbackRedemptions(records: PromotionRedemptionRecord[]) {
  try {
    await supabase.from("settings").upsert({
      key: "promotion_redemptions_data",
      value: JSON.stringify(records),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error saving fallback redemptions:", e);
  }
}

// Existing fallback claims storage
async function getFallbackClaims(): Promise<PromotionClaimRecord[]> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "promotion_claims_data")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

async function saveFallbackClaims(claims: PromotionClaimRecord[]) {
  try {
    await supabase.from("settings").upsert({
      key: "promotion_claims_data",
      value: JSON.stringify(claims),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error saving fallback promotion claims:", e);
  }
}

// ==========================================
// PROMOTION CRUD ACTIONS
// ==========================================

// Get all promotions (with real-time computed statuses)
export async function getPromotionsAction(includeInactive = false): Promise<Promotion[]> {
  try {
    let list: Promotion[] = [];
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      list = data as Promotion[];
    } else {
      list = await getFallbackPromotions();
    }

    // Also sync and merge any promotional records from Supabase announcements table (type = 'promotion')
    try {
      const { data: dbPromoAnnouncements } = await supabase
        .from("announcements")
        .select("*")
        .eq("type", "promotion");

      if (dbPromoAnnouncements && dbPromoAnnouncements.length > 0) {
        for (const item of dbPromoAnnouncements) {
          const exists = list.some(
            (p) => p.id === item.id || p.name.trim().toLowerCase() === item.title.trim().toLowerCase()
          );
          if (!exists) {
            const pctMatch = (item.description || item.title || "").match(/(\d+)%/);
            const discountPct = pctMatch ? parseInt(pctMatch[1], 10) : 10;
            list.push({
              id: item.id,
              name: item.title,
              type: "percentage",
              description: item.description || "Exclusive promotional offer.",
              terms: item.validity || "Terms and conditions apply.",
              image_url: item.image_url || "",
              is_active: item.is_active ?? true,
              status: item.is_active ? "active" : "inactive",
              start_date: item.created_at ? item.created_at.split("T")[0] : null,
              end_date: item.valid_until || null,
              discount_percent: discountPct,
              discount_amount: 0,
              min_spend: 0,
              bundle_price: 0,
              bundle_items: [],
              eligible_menu_item_ids: [],
              eligible_categories: [],
              applicable_days: [0, 1, 2, 3, 4, 5, 6],
              start_time: null,
              end_time: null,
              birthday_reward_item_id: null,
              birthday_reward_name: null,
              birthday_window_days: 7,
              max_total_redemptions: null,
              max_per_customer: 1,
              current_redemptions_count: 0,
              allow_stacking: false,
              sort_order: item.sort_order ?? 99,
              created_at: item.created_at,
              updated_at: item.updated_at,
            });
          }
        }
      }
    } catch (e) {
      // Non-blocking sync
    }

    // Compute dynamic status
    const withComputed = list.map((p) => ({
      ...p,
      status: computePromotionStatus(p),
    }));

    if (includeInactive) {
      return withComputed;
    }
    return withComputed.filter((p) => p.is_active);
  } catch (err) {
    console.error("Error in getPromotionsAction:", err);
    return DEFAULT_PROMOTIONS;
  }
}

// Get single promotion by ID
export async function getPromotionByIdAction(id: string): Promise<Promotion | null> {
  const all = await getPromotionsAction(true);
  return all.find((p) => p.id === id) || null;
}

// Create new promotion
export async function createPromotionAction(data: Partial<Promotion>) {
  try {
    if (!data.name || !data.name.trim()) {
      return { success: false, error: "Promotion name is required." };
    }
    if (!data.type) {
      return { success: false, error: "Promotion type is required." };
    }

    // Validation per type
    if (data.type === "percentage") {
      const pct = Number(data.discount_percent ?? 0);
      if (pct <= 0 || pct > 100) {
        return { success: false, error: "Discount percentage must be greater than 0% and at most 100%." };
      }
    }

    if (data.type === "fixed_amount") {
      const amt = Number(data.discount_amount ?? 0);
      if (amt <= 0) {
        return { success: false, error: "Fixed discount amount must be greater than ₱0." };
      }
    }

    if (data.type === "bundle") {
      if (!data.bundle_items || data.bundle_items.length === 0) {
        return { success: false, error: "A promotional bundle must contain at least one menu product." };
      }
      if (!data.bundle_price || Number(data.bundle_price) <= 0) {
        return { success: false, error: "Bundle promotional price must be greater than ₱0." };
      }
    }

    if (data.type === "happy_hour") {
      const pct = Number(data.discount_percent ?? 0);
      if (pct <= 0 || pct > 100) {
        return { success: false, error: "Happy hour discount percentage must be between 1% and 100%." };
      }
      if (!data.start_time || !data.end_time) {
        return { success: false, error: "Happy hour requires both a start time and end time (Asia/Manila)." };
      }
      if (data.start_time >= data.end_time) {
        return { success: false, error: "Happy hour start time must be earlier than the end time." };
      }
    }

    if (data.type === "birthday") {
      if (!data.birthday_reward_name && !data.birthday_reward_item_id) {
        return { success: false, error: "Please select or name the complimentary birthday reward." };
      }
    }

    // Validate dates
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      return { success: false, error: "Promotion start date cannot be after the expiration date." };
    }

    const newPromo: Promotion = {
      id: "promo-" + crypto.randomUUID(),
      name: data.name.trim(),
      type: data.type,
      description: data.description?.trim() || "",
      terms: data.terms?.trim() || "",
      image_url: data.image_url || "",
      is_active: data.is_active ?? true,
      status: data.status || "active",
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      discount_percent: Number(data.discount_percent || 0),
      discount_amount: Number(data.discount_amount || 0),
      min_spend: Number(data.min_spend || 0),
      bundle_price: Number(data.bundle_price || 0),
      bundle_items: data.bundle_items || [],
      eligible_menu_item_ids: data.eligible_menu_item_ids || [],
      eligible_categories: data.eligible_categories || [],
      applicable_days: data.applicable_days || [0, 1, 2, 3, 4, 5, 6],
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      birthday_reward_item_id: data.birthday_reward_item_id || null,
      birthday_reward_name: data.birthday_reward_name || null,
      birthday_window_days: Number(data.birthday_window_days || 7),
      max_total_redemptions: data.max_total_redemptions ? Number(data.max_total_redemptions) : null,
      max_per_customer: Number(data.max_per_customer || 1),
      current_redemptions_count: 0,
      allow_stacking: data.allow_stacking ?? false,
      sort_order: Number(data.sort_order || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try DB insert
    try {
      await supabase.from("promotions").insert([newPromo]);
    } catch (e) {
      // ignore if table not yet created
    }

    // Always sync fallback
    const fallback = await getFallbackPromotions();
    const updated = [newPromo, ...fallback];
    await saveFallbackPromotions(updated);

    // Sync to announcements table so public landing displays it
    try {
      await supabase.from("announcements").insert([{
        type: "promotion",
        title: newPromo.name,
        badge: newPromo.type === "happy_hour" ? "Happy Hour" : newPromo.type === "bundle" ? "Bundle Deal" : "Special Promo",
        description: newPromo.description,
        image_url: newPromo.image_url,
        validity: newPromo.end_date ? `Until ${newPromo.end_date}` : "Limited Time",
        valid_until: newPromo.end_date,
        link_url: "/reserve",
        link_text: "Claim This Promo Now",
        is_active: newPromo.is_active,
        show_banner: false,
        sort_order: 1,
      }]);
    } catch (e) {
      // ignore
    }

    revalidatePath("/admin/promotions");
    revalidatePath("/manager/promotions");
    revalidatePath("/promotions");
    revalidatePath("/announcements");
    revalidatePath("/reserve");
    revalidatePath("/");

    return { success: true, promotion: newPromo };
  } catch (err: any) {
    console.error("Error in createPromotionAction:", err);
    return { success: false, error: err.message || "Failed to create promotion" };
  }
}

// Update existing promotion
export async function updatePromotionAction(id: string, updates: Partial<Promotion>) {
  try {
    if (updates.type === "percentage" && updates.discount_percent !== undefined) {
      const pct = Number(updates.discount_percent);
      if (pct <= 0 || pct > 100) {
        return { success: false, error: "Discount percentage must be between 1% and 100%." };
      }
    }

    if (updates.start_date && updates.end_date && updates.start_date > updates.end_date) {
      return { success: false, error: "Promotion start date cannot be after the expiration date." };
    }

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Try DB update
    try {
      await supabase.from("promotions").update(payload).eq("id", id);
    } catch (e) {
      // ignore
    }

    // Sync fallback
    const fallback = await getFallbackPromotions();
    const idx = fallback.findIndex((p) => p.id === id);
    if (idx !== -1) {
      fallback[idx] = { ...fallback[idx], ...payload };
    }
    await saveFallbackPromotions(fallback);

    revalidatePath("/admin/promotions");
    revalidatePath("/manager/promotions");
    revalidatePath("/promotions");
    revalidatePath("/announcements");
    revalidatePath("/reserve");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Error in updatePromotionAction:", err);
    return { success: false, error: err.message || "Failed to update promotion" };
  }
}

// Toggle promotion active state
export async function togglePromotionActiveAction(id: string, is_active: boolean) {
  return updatePromotionAction(id, { is_active });
}

// Delete promotion
export async function deletePromotionAction(id: string) {
  try {
    try {
      await supabase.from("promotions").delete().eq("id", id);
    } catch (e) {
      // ignore
    }

    const fallback = await getFallbackPromotions();
    const filtered = fallback.filter((p) => p.id !== id);
    await saveFallbackPromotions(filtered);

    revalidatePath("/admin/promotions");
    revalidatePath("/manager/promotions");
    revalidatePath("/promotions");
    revalidatePath("/announcements");
    revalidatePath("/reserve");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Error in deletePromotionAction:", err);
    return { success: false, error: err.message || "Failed to delete promotion" };
  }
}

// ==========================================
// SERVER-SIDE PROMOTION EVALUATION & VALIDATION ENGINE
// ==========================================

export interface OrderItemInput {
  menu_item_id: string;
  name?: string;
  category?: string;
  price: number;
  quantity: number;
}

export interface EvaluateOrderPromotionsInput {
  cartItems: OrderItemInput[];
  serviceFee?: number;
  selectedPromotionId?: string | null;
  customerId?: string | null;
  customerDob?: string | null; // YYYY-MM-DD
  staffVerifiedBirthday?: boolean;
  staffName?: string;
}

export interface PromotionEvaluationItem {
  promotion: Promotion;
  eligible: boolean;
  reason?: string;
  calculatedDiscount: number;
  savingsBreakdown: string;
}

export interface OrderPromotionEvaluationResult {
  eligiblePromotions: PromotionEvaluationItem[];
  selectedPromotion: Promotion | null;
  selectedDiscount: number;
  appliedDiscount: number; // Final discount chosen/applied
  appliedDiscountType: "promotional" | "none";
  rawSubtotal: number;
  finalTotal: number;
  ruleExplanation: string;
  ineligibleReason?: string;
  bundleStockIssues?: string[];
}

export type PromotionEvaluationResult = OrderPromotionEvaluationResult;

export async function evaluateOrderPromotionsAction(
  input: EvaluateOrderPromotionsInput
): Promise<OrderPromotionEvaluationResult> {
  const {
    cartItems,
    serviceFee = 0,
    selectedPromotionId,
    customerId,
    customerDob,
    staffVerifiedBirthday = false,
  } = input;

  const allPromos = await getPromotionsAction(false); // active only
  const { dayOfWeek, currentTimeStr, currentDateStr, manilaDate } = getManilaDateTime();

  // 1. Calculate raw subtotals
  const menuSubtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const rawSubtotal = menuSubtotal + serviceFee;

  // 2. Fetch customer prior redemptions for usage limits
  let customerRedemptions: PromotionRedemptionRecord[] = [];
  if (customerId) {
    try {
      const { data } = await supabase
        .from("promotion_redemptions")
        .select("*")
        .eq("customer_id", customerId);
      if (data) customerRedemptions = data as PromotionRedemptionRecord[];
    } catch (e) {
      const fallbackReds = await getFallbackRedemptions();
      customerRedemptions = fallbackReds.filter((r) => r.customer_id === customerId);
    }
  }

  // 3. Evaluate each active promotion
  const evaluatedList: PromotionEvaluationItem[] = [];

  for (const promo of allPromos) {
    let eligible = true;
    let reason = "";
    let calculatedDiscount = 0;
    let savingsBreakdown = "";

    // Date check (Manila time)
    if (promo.start_date && promo.start_date > currentDateStr) {
      eligible = false;
      reason = `Promotion begins on ${promo.start_date}.`;
    }
    if (promo.end_date && promo.end_date < currentDateStr) {
      eligible = false;
      reason = `Promotion expired on ${promo.end_date}.`;
    }

    // Total redemption limit check
    if (promo.max_total_redemptions && promo.current_redemptions_count >= promo.max_total_redemptions) {
      eligible = false;
      reason = "Maximum total redemptions for this promotion has been reached.";
    }

    // Per-customer limit check
    if (customerId && promo.max_per_customer) {
      const timesRedeemed = customerRedemptions.filter((r) => r.promotion_id === promo.id).length;
      if (timesRedeemed >= promo.max_per_customer) {
        eligible = false;
        reason = `You have already reached the maximum limit (${promo.max_per_customer}) for this offer.`;
      }
    }

    // TYPE A: Percentage Discount
    if (promo.type === "percentage") {
      if (rawSubtotal < promo.min_spend) {
        eligible = false;
        reason = `Requires a minimum spend of ₱${promo.min_spend.toLocaleString()} (Current: ₱${rawSubtotal.toLocaleString()}).`;
      } else {
        // Calculate eligible items or whole order
        let eligibleBase = rawSubtotal;
        if (promo.eligible_categories.length > 0) {
          eligibleBase = cartItems
            .filter((it) => promo.eligible_categories.includes(it.category || ""))
            .reduce((sum, it) => sum + it.price * it.quantity, 0);
          if (eligibleBase === 0) {
            eligible = false;
            reason = `No items in cart match eligible categories (${promo.eligible_categories.join(", ")}).`;
          }
        }
        calculatedDiscount = Math.round((eligibleBase * promo.discount_percent) / 100);
        savingsBreakdown = `${promo.discount_percent}% off qualifying items (₱${calculatedDiscount.toLocaleString()} savings)`;
      }
    }

    // TYPE B: Fixed Amount Discount
    else if (promo.type === "fixed_amount") {
      if (rawSubtotal < promo.min_spend) {
        eligible = false;
        reason = `Minimum spend of ₱${promo.min_spend.toLocaleString()} required. Spend ₱${(promo.min_spend - rawSubtotal).toLocaleString()} more to qualify.`;
      } else {
        // Never exceed rawSubtotal
        calculatedDiscount = Math.min(rawSubtotal, promo.discount_amount);
        savingsBreakdown = `₱${calculatedDiscount.toLocaleString()} off on orders ₱${promo.min_spend.toLocaleString()}+`;
      }
    }

    // TYPE C: Bundle Promo
    else if (promo.type === "bundle") {
      // Calculate standard price of bundle items
      const regularPrice = promo.bundle_items.reduce((s, it) => s + it.original_price * it.quantity, 0);
      const savings = Math.max(0, regularPrice - promo.bundle_price);
      calculatedDiscount = savings;
      savingsBreakdown = `Complete Bundle for ₱${promo.bundle_price.toLocaleString()} (Save ₱${savings.toLocaleString()} vs regular ₱${regularPrice.toLocaleString()})`;
    }

    // TYPE D: Happy Hour Promo
    else if (promo.type === "happy_hour") {
      // Validate applicable days
      if (!promo.applicable_days.includes(dayOfWeek)) {
        eligible = false;
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const allowed = promo.applicable_days.map((d) => dayNames[d]).join(", ");
        reason = `Happy Hour is only available on: ${allowed}. (Today is ${dayNames[dayOfWeek]}).`;
      }
      // Validate schedule time in Asia/Manila
      else if (promo.start_time && promo.end_time) {
        if (currentTimeStr < promo.start_time || currentTimeStr > promo.end_time) {
          eligible = false;
          reason = `Happy Hour runs strictly from ${promo.start_time} to ${promo.end_time} (Asia/Manila time). Current time: ${currentTimeStr}.`;
        }
      }

      if (eligible) {
        // Compute discount on eligible drinks/categories
        let happyBase = 0;
        if (promo.eligible_categories.length > 0) {
          happyBase = cartItems
            .filter((it) => promo.eligible_categories.includes(it.category || ""))
            .reduce((sum, it) => sum + it.price * it.quantity, 0);
        } else {
          happyBase = menuSubtotal;
        }

        if (happyBase <= 0) {
          eligible = false;
          reason = `Add eligible drinks or items (${promo.eligible_categories.join(", ") || "Beverages"}) to avail Happy Hour discount.`;
        } else {
          calculatedDiscount = Math.round((happyBase * promo.discount_percent) / 100);
          savingsBreakdown = `Happy Hour Active! ${promo.discount_percent}% off qualifying items (₱${calculatedDiscount.toLocaleString()} saved)`;
        }
      }
    }

    // TYPE E: Birthday Promo
    else if (promo.type === "birthday") {
      let isBirthdayEligible = false;
      const currentYear = manilaDate.getFullYear();

      // Check if already redeemed this calendar year
      const alreadyRedeemedThisYear = customerRedemptions.some((r) => {
        if (r.promotion_id !== promo.id) return false;
        const redYear = new Date(r.redeemed_at).getFullYear();
        return redYear === currentYear;
      });

      if (alreadyRedeemedThisYear) {
        eligible = false;
        reason = "You have already redeemed your Birthday Special for this calendar year.";
      } else if (staffVerifiedBirthday) {
        // Staff verified ID presented at POS / entrance
        isBirthdayEligible = true;
      } else if (customerDob) {
        // Check date of birth (month & day)
        try {
          const dobDate = new Date(customerDob);
          const currentMonth = manilaDate.getMonth();
          const dobMonth = dobDate.getMonth();

          // In birthday month or within birthday_window_days
          if (dobMonth === currentMonth) {
            isBirthdayEligible = true;
          } else {
            // Check day difference
            const thisYearBday = new Date(currentYear, dobMonth, dobDate.getDate());
            const diffDays = Math.abs((manilaDate.getTime() - thisYearBday.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= promo.birthday_window_days) {
              isBirthdayEligible = true;
            }
          }
        } catch (e) {
          isBirthdayEligible = false;
        }

        if (!isBirthdayEligible) {
          eligible = false;
          reason = `Your birthday does not fall within the active eligibility window (+/-${promo.birthday_window_days} days).`;
        }
      } else {
        eligible = false;
        reason = "Date of Birth not registered. Please update your profile or present a valid ID to staff for birthday verification.";
      }

      if (eligible && isBirthdayEligible) {
        if (rawSubtotal < promo.min_spend) {
          eligible = false;
          reason = `Requires an order subtotal of at least ₱${promo.min_spend.toLocaleString()} to claim your birthday treat.`;
        } else {
          calculatedDiscount = promo.discount_amount || 39; // value of dessert/treat
          savingsBreakdown = `Complimentary Birthday Reward: ${promo.birthday_reward_name || "Special Sweet Treat"} (₱${calculatedDiscount.toLocaleString()} value)`;
        }
      }
    }

    evaluatedList.push({
      promotion: promo,
      eligible,
      reason,
      calculatedDiscount: eligible ? calculatedDiscount : 0,
      savingsBreakdown,
    });
  }

  // 4. Determine selected promo
  const selectedEvalItem = selectedPromotionId
    ? evaluatedList.find((e) => e.promotion.id === selectedPromotionId)
    : null;
  const selectedEval = selectedEvalItem && selectedEvalItem.eligible ? selectedEvalItem : null;
  const ineligibleReason = selectedEvalItem && !selectedEvalItem.eligible ? selectedEvalItem.reason : undefined;

  const selectedDiscount = selectedEval?.calculatedDiscount ?? 0;

  let appliedDiscount = 0;
  let appliedDiscountType: "promotional" | "none" = "none";
  let ruleExplanation = "";

  if (selectedEval) {
    appliedDiscount = selectedDiscount;
    appliedDiscountType = "promotional";
    ruleExplanation = `Promotion "${selectedEval.promotion.name}" applied: ₱${selectedDiscount.toLocaleString()} discount.`;
  } else {
    appliedDiscount = 0;
    appliedDiscountType = "none";
    ruleExplanation = "No promotional discount applied.";
  }

  const finalTotal = Math.max(0, rawSubtotal - appliedDiscount);

  return {
    eligiblePromotions: evaluatedList,
    selectedPromotion: selectedEval?.promotion || null,
    selectedDiscount,
    appliedDiscount,
    appliedDiscountType,
    rawSubtotal,
    finalTotal,
    ruleExplanation,
    ineligibleReason,
  };
}

// ==========================================
// ORDER / POS CONFIRMATION & REDEMPTION RECORDING
// ==========================================

export async function recordPromotionRedemptionAction(data: {
  promotion_id: string;
  promotion_name: string;
  promotion_type: PromotionType;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  order_id?: string | null;
  discount_amount: number;
  reward_details?: any;
  processed_by?: string;
  verified_birthday?: boolean;
}) {
  try {
    const newRedemption: PromotionRedemptionRecord = {
      id: crypto.randomUUID(),
      promotion_id: data.promotion_id,
      promotion_name: data.promotion_name,
      promotion_type: data.promotion_type,
      customer_id: data.customer_id || null,
      customer_name: data.customer_name || "Customer",
      customer_email: data.customer_email || null,
      order_id: data.order_id || null,
      discount_amount: data.discount_amount,
      reward_details: data.reward_details || null,
      redeemed_at: new Date().toISOString(),
      processed_by: data.processed_by || "System",
      verified_birthday: data.verified_birthday || false,
    };

    // 1. Try DB insert
    try {
      await supabase.from("promotion_redemptions").insert([newRedemption]);
    } catch (e) {
      // ignore
    }

    // 2. Sync fallback redemptions
    const fallbackReds = await getFallbackRedemptions();
    fallbackReds.unshift(newRedemption);
    await saveFallbackRedemptions(fallbackReds);

    // 3. Atomically increment current_redemptions_count in promotions
    try {
      const allPromos = await getFallbackPromotions();
      const pIdx = allPromos.findIndex((p) => p.id === data.promotion_id);
      if (pIdx >= 0) {
        allPromos[pIdx].current_redemptions_count = (allPromos[pIdx].current_redemptions_count || 0) + 1;
        await saveFallbackPromotions(allPromos);
        try {
          await supabase
            .from("promotions")
            .update({ current_redemptions_count: allPromos[pIdx].current_redemptions_count })
            .eq("id", data.promotion_id);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    revalidatePath("/admin/promotions");
    revalidatePath("/manager/promotions");
    revalidatePath("/admin");
    return { success: true, redemption: newRedemption };
  } catch (err: any) {
    console.error("Error in recordPromotionRedemptionAction:", err);
    return { success: false, error: err.message };
  }
}

// ==========================================
// PROMOTION PERFORMANCE STATS
// ==========================================

export async function getPromotionStatsAction() {
  try {
    const promos = await getPromotionsAction(true);
    let redemptions: PromotionRedemptionRecord[] = [];

    try {
      const { data } = await supabase.from("promotion_redemptions").select("*");
      if (data) redemptions = data as PromotionRedemptionRecord[];
    } catch (e) {
      redemptions = await getFallbackRedemptions();
    }

    const totalPromotions = promos.length;
    const activePromotions = promos.filter((p) => p.status === "active").length;
    const totalRedemptions = redemptions.length;
    const totalDiscountGranted = redemptions.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);

    const { currentTimeStr, dayOfWeek } = getManilaDateTime();
    const isHappyHourLive = promos.some(
      (p) =>
        p.type === "happy_hour" &&
        p.is_active &&
        p.applicable_days.includes(dayOfWeek) &&
        p.start_time &&
        p.end_time &&
        currentTimeStr >= p.start_time &&
        currentTimeStr <= p.end_time
    );

    return {
      totalPromotions,
      activePromotions,
      totalRedemptions,
      totalDiscountGranted,
      isHappyHourLive,
      recentRedemptions: redemptions.slice(0, 10),
    };
  } catch (e) {
    return {
      totalPromotions: 0,
      activePromotions: 0,
      totalRedemptions: 0,
      totalDiscountGranted: 0,
      isHappyHourLive: false,
      recentRedemptions: [],
    };
  }
}

// ==========================================
// PRESERVED COMPATIBILITY ACTIONS (CLAIMS)
// ==========================================

export async function claimPromotionAction(data: {
  promotion_id: string;
  promotion_title: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  discount_percent?: number;
  discount_amount?: number;
}) {
  try {
    if (!data.customer_id) {
      return { success: false, error: "You must be signed in to claim this promotion." };
    }

    try {
      const { data: existing, error: checkError } = await supabase
        .from("promotion_claims")
        .select("id, status")
        .eq("promotion_id", data.promotion_id)
        .eq("customer_id", data.customer_id)
        .maybeSingle();

      if (!checkError && existing) {
        if (existing.status === "pending") {
          return { success: false, error: "You have already claimed this promo. Your claim is pending admin approval." };
        }
        if (existing.status === "approved") {
          return { success: false, error: "You have already claimed this promo and it has been approved! You can apply it on checkout." };
        }
        if (existing.status === "used") {
          return { success: false, error: "You have already claimed and used this promotion." };
        }
      }
    } catch (e) {
      // ignore
    }

    const newClaim: PromotionClaimRecord = {
      id: crypto.randomUUID(),
      promotion_id: data.promotion_id,
      promotion_title: data.promotion_title,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone || "",
      discount_percent: data.discount_percent || 15,
      discount_amount: data.discount_amount || 0,
      status: "pending",
      claimed_at: new Date().toISOString(),
    };

    try {
      await supabase.from("promotion_claims").insert([newClaim]);
    } catch (e) {
      // ignore
    }

    const fallbackList = await getFallbackClaims();
    const existingIndex = fallbackList.findIndex(
      (c) => c.promotion_id === data.promotion_id && c.customer_id === data.customer_id
    );
    if (existingIndex >= 0) {
      const existing = fallbackList[existingIndex];
      if (existing.status === "pending" || existing.status === "approved" || existing.status === "used") {
        return { success: false, error: `You have already claimed this promo (${existing.status}).` };
      }
      fallbackList[existingIndex] = newClaim;
    } else {
      fallbackList.unshift(newClaim);
    }
    await saveFallbackClaims(fallbackList);

    // Notify admin
    await supabase.from("notifications").insert([{
      user_id: null,
      type: "info",
      title: "New Promo Claim Submitted",
      message: `${data.customer_name} has claimed promo: "${data.promotion_title}". Awaiting your review & approval.`,
      read: false,
    }]);

    revalidatePath("/announcements");
    revalidatePath("/admin/announcements");
    revalidatePath("/reserve");
    return { success: true, claim: newClaim };
  } catch (err: any) {
    console.error("Error in claimPromotionAction:", err);
    return { success: false, error: err.message || "Failed to claim promotion" };
  }
}

export async function getCustomerPromotionClaimsAction(customerId: string): Promise<PromotionClaimRecord[]> {
  if (!customerId) return [];
  try {
    const { data, error } = await supabase
      .from("promotion_claims")
      .select("*")
      .eq("customer_id", customerId)
      .order("claimed_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data as PromotionClaimRecord[];
    }
  } catch (e) {
    // fallback
  }

  const fallback = await getFallbackClaims();
  return fallback.filter((c) => c.customer_id === customerId);
}

export async function getAllPromotionClaimsAction(): Promise<PromotionClaimRecord[]> {
  try {
    const { data, error } = await supabase
      .from("promotion_claims")
      .select("*")
      .order("claimed_at", { ascending: false });

    if (!error && data) {
      return data as PromotionClaimRecord[];
    }
  } catch (e) {
    // fallback
  }
  return await getFallbackClaims();
}

export async function updatePromotionClaimStatusAction(data: {
  claim_id: string;
  status: "approved" | "rejected" | "used";
  notes?: string;
}) {
  try {
    let targetClaim: PromotionClaimRecord | null = null;

    try {
      const updatePayload: Record<string, any> = {
        status: data.status,
        reviewed_at: new Date().toISOString(),
      };
      if (data.status === "used") {
        updatePayload.used_at = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from("promotion_claims")
        .update(updatePayload)
        .eq("id", data.claim_id)
        .select();

      if (!error && updated && updated.length > 0) {
        targetClaim = updated[0] as PromotionClaimRecord;
      }
    } catch (e) {
      console.warn("promotion_claims DB update error:", e);
    }

    const fallbackList = await getFallbackClaims();
    const idx = fallbackList.findIndex((c) => c.id === data.claim_id);
    if (idx >= 0) {
      fallbackList[idx].status = data.status;
      if (data.notes) fallbackList[idx].notes = data.notes;
      fallbackList[idx].updated_at = new Date().toISOString();
      if (!targetClaim) {
        targetClaim = fallbackList[idx];
      }
      await saveFallbackClaims(fallbackList);
    }

    if (targetClaim) {
      const isApproved = data.status === "approved";
      await supabase.from("notifications").insert([{
        user_id: targetClaim.customer_id,
        type: isApproved ? "success" : data.status === "used" ? "info" : "warning",
        title: isApproved ? "Promo Claim Approved! 🎉" : data.status === "used" ? "Promo Applied to Billing" : "Promo Claim Update",
        message: isApproved
          ? `Your claim for "${targetClaim.promotion_title}" (${targetClaim.discount_percent}% off) has been approved! You can now apply it to your reservation.`
          : data.status === "used"
          ? `Your promotion "${targetClaim.promotion_title}" was applied to your reservation.`
          : `Your claim for "${targetClaim.promotion_title}" could not be approved at this time.`,
        read: false,
      }]);
    }

    revalidatePath("/admin/announcements");
    revalidatePath("/announcements");
    revalidatePath("/reserve");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updatePromotionClaimStatusAction:", err);
    return { success: false, error: err.message || "Failed to update claim" };
  }
}

export async function applyPromotionToReservationAction(claimId: string, reservationId: string) {
  try {
    try {
      await supabase
        .from("promotion_claims")
        .update({
          status: "used",
          reservation_id: reservationId,
          used_at: new Date().toISOString(),
        })
        .eq("id", claimId);
    } catch (e) {
      // fallback
    }

    const fallbackList = await getFallbackClaims();
    const idx = fallbackList.findIndex((c) => c.id === claimId);
    if (idx >= 0) {
      fallbackList[idx].status = "used";
      fallbackList[idx].reservation_id = reservationId;
      await saveFallbackClaims(fallbackList);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in applyPromotionToReservationAction:", err);
    return { success: false, error: err.message };
  }
}
