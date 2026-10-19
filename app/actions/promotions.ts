"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  updated_at?: string;
}

// Fallback storage in settings in case table doesn't exist yet
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

// Claim a promotion for a customer
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

    // 1. Check if already claimed by this customer
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
      // ignore if table not yet created
    }

    const newClaim: PromotionClaimRecord = {
      id: crypto.randomUUID(),
      promotion_id: data.promotion_id,
      promotion_title: data.promotion_title,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone || "",
      discount_percent: data.discount_percent || 15, // Default 15% promo discount
      discount_amount: data.discount_amount || 0,
      status: "pending", // Requires admin approval
      claimed_at: new Date().toISOString(),
    };

    // Try DB insert
    let inserted = false;
    try {
      const { error: insertError } = await supabase
        .from("promotion_claims")
        .insert([newClaim]);

      if (!insertError) {
        inserted = true;
      }
    } catch (e) {
      // fallback
    }

    // Always maintain fallback sync
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

    // Notify customer
    await supabase.from("notifications").insert([{
      user_id: data.customer_id,
      type: "info",
      title: "Promotion Claim Submitted",
      message: `Your claim for "${data.promotion_title}" has been submitted for approval. We will notify you once approved!`,
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

// Get claims for the current logged-in customer
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

// Get all claims for Admin
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

// Admin approve or reject a claim
export async function updatePromotionClaimStatusAction(data: {
  claim_id: string;
  status: "approved" | "rejected" | "used";
  notes?: string;
}) {
  try {
    let targetClaim: PromotionClaimRecord | null = null;

    // Try DB update
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

    // Fallback sync
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
      // Notify customer of decision
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

// Mark promo claim as used upon reservation completion
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
