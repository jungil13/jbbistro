"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getPublicSiteUrl } from "@/lib/email";
import { validateAndDeductStockAction } from "@/app/actions/menu";
import { sendReservationConfirmationEmailAction } from "@/app/actions/reservationEmail";
import {
  applyPromotionToReservationAction,
  recordPromotionRedemptionAction,
} from "@/app/actions/promotions";

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || "";
const PAYMONGO_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY || "";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iqqgysfbtqcgkuwvssqh.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxcWd5c2ZidHFjZ2t1d3Zzc3FoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkyMjk1MSwiZXhwIjoyMDk5NDk4OTUxfQ.zDUyaKC0Q_VHAnFMF9wghlUfAZSnrIjmND5YqglMl7w"
);

function getPayMongoAuthHeaders() {
  const encoded = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64");
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${encoded}`,
  };
}

export interface PayMongoLineItemInput {
  name: string;
  quantity: number;
  amount: number; // in PHP
  currency?: string;
  description?: string;
}

export interface CreatePayMongoCheckoutInput {
  reservationId?: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string | null;
  serviceName: string;
  serviceType: string;
  date: string;
  time: string;
  guests: number;
  membership?: string;
  notes?: string;
  totalAmount: number; // in PHP
  rawSubtotal?: number;
  promoDiscount?: number;
  selectedPromoId?: string | null;
  selectedClaimId?: string | null;
  selectedBundleId?: string | null;
  menuItemsToDeduct: Array<{ menu_item_id: string; quantity: number }>;
  clientOrigin?: string;
}

/**
 * Creates a PayMongo Checkout Session for online reservation payment.
 * Supports GCash, PayMaya, Credit/Debit Cards, GrabPay, and Direct Online Banking.
 */
export async function createPayMongoCheckoutSessionAction(input: CreatePayMongoCheckoutInput) {
  try {
    const totalPhp = Math.max(0, Number(input.totalAmount || 0));
    if (totalPhp <= 0) {
      return { success: false, error: "Total amount must be greater than ₱0 to proceed with online payment." };
    }

    const reservationId = input.reservationId || crypto.randomUUID();
    const siteUrl = (input.clientOrigin && !input.clientOrigin.includes("undefined"))
      ? input.clientOrigin.replace(/\/$/, "")
      : getPublicSiteUrl();

    // PayMongo line items amount is in centavos (PHP * 100)
    // PayMongo requires all line item amounts to be >= 100 centavos (₱1.00) and positive integers
    const totalCentavos = Math.round(totalPhp * 100);

    const lineItems = [
      {
        name: `Jbenz Bistro: ${input.serviceName || "Reservation"} (${input.guests} pax)`,
        description: `Booking on ${input.date} at ${input.time}${input.promoDiscount && input.promoDiscount > 0 ? ` (₱${input.promoDiscount} discount applied)` : ""}`,
        amount: totalCentavos,
        currency: "PHP",
        quantity: 1,
      },
    ];

    // Payload for PayMongo Checkout Session
    const payload = {
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description: `Jbenz Bistro reservation for ${input.customerName} on ${input.date} at ${input.time}`,
          line_items: lineItems,
          payment_method_types: ["gcash", "paymaya", "card", "grab_pay", "dob"],
          billing: {
            name: input.customerName || "Valued Guest",
            email: input.customerEmail || "customer@jbenzbistro.shop",
            phone: input.customerPhone || "09123456789",
          },
          metadata: {
            reservation_id: reservationId,
            customer_id: input.customerId || "",
            customer_name: input.customerName || "",
            customer_email: input.customerEmail || "",
            customer_phone: input.customerPhone || "",
            service_id: input.serviceId || "",
            service_name: input.serviceName || "Bistro Reservation",
            service_type: input.serviceType || "dining",
            date: input.date,
            time: input.time,
            guests: String(input.guests || 2),
            membership: input.membership || "Member",
            total_amount: String(totalPhp),
            notes: input.notes || "",
            selected_promo_id: input.selectedPromoId || "",
            selected_claim_id: input.selectedClaimId || "",
            selected_bundle_id: input.selectedBundleId || "",
            promo_discount: String(input.promoDiscount || 0),
            menu_items_json: JSON.stringify(input.menuItemsToDeduct || []),
          },
          success_url: `${siteUrl}/reserve/payment-success?reservation_id=${reservationId}`,
          cancel_url: `${siteUrl}/reserve?payment_cancelled=true`,
        },
      },
    };

    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: getPayMongoAuthHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result?.data) {
      console.error("PayMongo create checkout session error:", result);
      const errMsg = result?.errors?.[0]?.detail || "Failed to initialize PayMongo checkout session.";
      return { success: false, error: errMsg };
    }

    const session = result.data;
    const checkoutUrl = session.attributes?.checkout_url;

    // Pre-insert pending reservation and link checkout session ID
    try {
      await supabase.from("reservations").upsert([
        {
          id: reservationId,
          customer_id: input.customerId || null,
          customer_name: input.customerName || "Valued Guest",
          customer_email: input.customerEmail || null,
          customer_phone: input.customerPhone || "",
          service_id: input.serviceId || null,
          date: input.date,
          time_start: input.time,
          guests: Number(input.guests) || 2,
          status: "pending",
          total_amount: totalPhp,
          notes: `${input.notes || ""} | [PayMongo Checkout: ${session.id}]`.trim(),
        },
      ]);

      await supabase.from("payments").upsert([
        {
          reservation_id: reservationId,
          method: "gcash",
          gcash_number: "PayMongo Gateway",
          reference_number: session.id,
          receipt_url: checkoutUrl || "https://checkout.paymongo.com",
          amount: totalPhp,
          status: "pending",
        },
      ]);

      if (input.menuItemsToDeduct && input.menuItemsToDeduct.length > 0) {
        const menuRows = input.menuItemsToDeduct.map((it) => ({
          reservation_id: reservationId,
          menu_item_id: it.menu_item_id,
          quantity: it.quantity,
        }));
        await supabase.from("reservation_menu").delete().eq("reservation_id", reservationId);
        await supabase.from("reservation_menu").insert(menuRows);
      }
    } catch (dbErr) {
      console.warn("Could not pre-insert pending reservation:", dbErr);
    }

    // Save pending session ID in cookie store for customer continuity
    try {
      const cookieStore = await cookies();
      cookieStore.set("paymongo_pending_session_id", session.id, {
        path: "/",
        maxAge: 60 * 60 * 2, // 2 hours
        sameSite: "lax",
      });
      cookieStore.set("paymongo_pending_reservation_id", reservationId, {
        path: "/",
        maxAge: 60 * 60 * 2,
        sameSite: "lax",
      });
    } catch (cookieErr) {
      console.warn("Could not set pending session cookie:", cookieErr);
    }

    return {
      success: true,
      sessionId: session.id,
      checkoutUrl,
      reservationId,
    };
  } catch (err: any) {
    console.error("Error in createPayMongoCheckoutSessionAction:", err);
    return { success: false, error: err?.message || "Failed to initiate online payment." };
  }
}

/**
 * Retrieves a PayMongo Checkout Session by its ID.
 */
export async function getPayMongoCheckoutSessionAction(sessionId: string) {
  try {
    if (!sessionId) return { success: false, error: "Session ID is required." };

    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      method: "GET",
      headers: getPayMongoAuthHeaders(),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok || !result?.data) {
      return { success: false, error: result?.errors?.[0]?.detail || "Failed to retrieve PayMongo session." };
    }

    return { success: true, session: result.data };
  } catch (err: any) {
    console.error("Error in getPayMongoCheckoutSessionAction:", err);
    return { success: false, error: err?.message || "Error retrieving session." };
  }
}

/**
 * Verifies that the PayMongo session was paid, creates or confirms the reservation in Supabase,
 * records the verified payment, updates stock, applies vouchers, and dispatches confirmation email.
 */
export async function verifyAndFinalizePayMongoReservationAction(
  param: string | { sessionId?: string | null; reservationId?: string | null }
) {
  try {
    let sessionId = typeof param === "string" ? param : param?.sessionId;
    let reservationId = typeof param === "object" ? param?.reservationId : null;

    // Clean up literal placeholder if present
    if (sessionId && (sessionId.includes("{CHECKOUT_SESSION_ID}") || !sessionId.startsWith("cs_"))) {
      if (!reservationId && sessionId !== "{CHECKOUT_SESSION_ID}") {
        reservationId = sessionId;
      }
      sessionId = null;
    }

    // 0. Immediate Check: If reservation is already confirmed/verified, return it directly!
    if (reservationId) {
      const { data: existingRes } = await supabase
        .from("reservations")
        .select(`
          *,
          services ( id, name, type, hourly_rate ),
          payments ( id, method, reference_number, gcash_number, amount, status )
        `)
        .eq("id", reservationId)
        .maybeSingle();

      const existingPay = Array.isArray(existingRes?.payments)
        ? existingRes.payments[0]
        : existingRes?.payments;

      if (existingRes && (existingRes.status === "confirmed" || existingPay?.status === "verified")) {
        return {
          success: true,
          alreadyProcessed: true,
          reservationId: existingRes.id,
          reservation: existingRes,
          paymentDetails: {
            paymentId: existingPay?.reference_number || "Verified",
            method: existingPay?.gcash_number || "PAYMONGO",
            amount: existingPay?.amount || existingRes.total_amount,
            status: "verified",
          },
        };
      }

      // Check if session.id was saved in reservation notes e.g. [PayMongo Checkout: cs_xxx]
      if (!sessionId && existingRes?.notes) {
        const match = existingRes.notes.match(/\[PayMongo Checkout:\s*(cs_[^\]]+)\]/);
        if (match && match[1]) {
          sessionId = match[1].trim();
        }
      }
    }

    // 1. If no valid sessionId, look up via reservationId in payments table
    if (!sessionId && reservationId) {
      const { data: payRow } = await supabase
        .from("payments")
        .select("reference_number, status, amount, gcash_number")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      if (payRow?.status === "verified") {
        const { data: existingRes } = await supabase
          .from("reservations")
          .select(`
            *,
            services ( id, name, type, hourly_rate ),
            payments ( id, method, reference_number, gcash_number, amount, status )
          `)
          .eq("id", reservationId)
          .maybeSingle();

        return {
          success: true,
          alreadyProcessed: true,
          reservationId,
          reservation: existingRes,
          paymentDetails: {
            paymentId: payRow.reference_number || "Verified",
            method: payRow.gcash_number || "PAYMONGO",
            amount: payRow.amount,
            status: "verified",
          },
        };
      }

      if (payRow?.reference_number?.startsWith("cs_")) {
        sessionId = payRow.reference_number;
      }
    }

    // 2. If still no valid sessionId, check cookieStore
    if (!sessionId) {
      try {
        const cookieStore = await cookies();
        const cookieSessionId = cookieStore.get("paymongo_pending_session_id")?.value;
        if (cookieSessionId?.startsWith("cs_")) {
          sessionId = cookieSessionId;
        }
        if (!reservationId) {
          reservationId = cookieStore.get("paymongo_pending_reservation_id")?.value || null;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!sessionId) {
      return { success: false, error: "Missing PayMongo checkout session ID." };
    }

    // 3. Fetch checkout session directly from PayMongo
    const sessionRes = await getPayMongoCheckoutSessionAction(sessionId);
    if (!sessionRes.success || !sessionRes.session) {
      return { success: false, error: sessionRes.error || "Could not retrieve checkout session from PayMongo." };
    }

    const session = sessionRes.session;
    const payments = session.attributes?.payments || [];
    const paidPayment = payments.find((p: any) => p.attributes?.status === "paid") || payments[0];

    // Verify payment status
    const isPaid =
      session.attributes?.status === "paid" ||
      paidPayment?.attributes?.status === "paid" ||
      payments.some((p: any) => p.attributes?.status === "paid");

    if (!isPaid || !paidPayment) {
      return {
        success: false,
        error: "Payment has not been completed or verified yet. Please check your payment status.",
        sessionStatus: session.attributes?.status,
      };
    }

    const paymentId = paidPayment.id; // e.g. pay_xxx
    const paymentSourceType = paidPayment.attributes?.source?.type || "paymongo";
    const amountPaidCentavos = paidPayment.attributes?.amount || session.attributes?.line_items?.[0]?.amount || 0;
    const amountPaidPhp = amountPaidCentavos / 100;
    const metadata = session.attributes?.metadata || {};

    const targetReservationId = reservationId || metadata.reservation_id || crypto.randomUUID();

    // 4. Idempotency check: see if reservation or payment is already finalized with status: 'verified'
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, reservation_id, status, reference_number")
      .or(`reference_number.eq.${paymentId},reservation_id.eq.${targetReservationId}`)
      .maybeSingle();

    if (existingPayment && existingPayment.status === "verified") {
      const { data: existingRes } = await supabase
        .from("reservations")
        .select(`
          *,
          services ( id, name, type, hourly_rate ),
          payments ( id, method, reference_number, amount, status )
        `)
        .eq("id", existingPayment.reservation_id)
        .single();

      return {
        success: true,
        alreadyProcessed: true,
        reservationId: existingPayment.reservation_id,
        reservation: existingRes,
        paymentDetails: {
          paymentId,
          method: paymentSourceType,
          amount: amountPaidPhp,
          status: "verified",
        },
      };
    }

    // 5. Deduct stocks for pre-ordered menu / bundle items
    let menuItemsToDeduct: Array<{ menu_item_id: string; quantity: number }> = [];
    if (metadata.menu_items_json) {
      try {
        menuItemsToDeduct = JSON.parse(metadata.menu_items_json);
      } catch (e) {
        menuItemsToDeduct = [];
      }
    }

    if (menuItemsToDeduct.length > 0) {
      try {
        await validateAndDeductStockAction(menuItemsToDeduct);
      } catch (stockErr) {
        console.warn("Stock deduction warning during PayMongo finalization:", stockErr);
      }
    }

    // 6. Build reservation notes
    const noteParts: string[] = [];
    if (metadata.membership) noteParts.push(`Membership: ${metadata.membership}`);
    if (metadata.notes) noteParts.push(metadata.notes);
    noteParts.push(`[PayMongo Gateway Verified: ${paymentSourceType.toUpperCase()} | Ref: ${paymentId}]`);
    const fullNotes = noteParts.join(" | ");

    // 7. Update or insert reservation as CONFIRMED
    const { data: newReservation, error: resInsertError } = await supabase
      .from("reservations")
      .upsert([
        {
          id: targetReservationId,
          customer_id: metadata.customer_id || null,
          customer_name: metadata.customer_name || "Valued Guest",
          customer_email: metadata.customer_email || null,
          customer_phone: metadata.customer_phone || "",
          service_id: metadata.service_id || null,
          date: metadata.date,
          time_start: metadata.time,
          guests: Number(metadata.guests) || 2,
          status: "confirmed", // Verified PayMongo payment = CONFIRMED
          total_amount: Number(metadata.total_amount) || amountPaidPhp,
          notes: fullNotes,
        },
      ])
      .select()
      .single();

    if (resInsertError) {
      console.error("Error creating/updating reservation after PayMongo payment:", resInsertError);
      return { success: false, error: resInsertError.message };
    }

    // 8. Update or insert payment record as VERIFIED
    const paymentMethodStored = paymentSourceType.toLowerCase().includes("cash") ? "cash" : "gcash";

    if (existingPayment) {
      await supabase
        .from("payments")
        .update({
          method: paymentMethodStored,
          gcash_number: `PayMongo (${paymentSourceType.toUpperCase()})`,
          reference_number: paymentId,
          receipt_url: "https://checkout.paymongo.com",
          amount: amountPaidPhp,
          status: "verified",
        })
        .eq("id", existingPayment.id);
    } else {
      await supabase.from("payments").insert([
        {
          reservation_id: targetReservationId,
          method: paymentMethodStored,
          gcash_number: `PayMongo (${paymentSourceType.toUpperCase()})`,
          reference_number: paymentId,
          receipt_url: "https://checkout.paymongo.com",
          amount: amountPaidPhp,
          status: "verified",
        },
      ]);
    }

    // 9. Insert pre-ordered items into reservation_menu
    if (menuItemsToDeduct.length > 0) {
      try {
        const menuRows = menuItemsToDeduct.map((it) => ({
          reservation_id: targetReservationId,
          menu_item_id: it.menu_item_id,
          quantity: it.quantity,
        }));
        await supabase.from("reservation_menu").delete().eq("reservation_id", targetReservationId);
        const { error: insErr } = await supabase.from("reservation_menu").insert(menuRows);
        if (insErr) {
          console.error("Reservation menu insert error:", insErr);
        }
      } catch (menuErr) {
        console.warn("Reservation menu insert error:", menuErr);
      }
    }

    // 10. Process promotion voucher redemption if applied
    try {
      if (metadata.selected_claim_id) {
        await applyPromotionToReservationAction(metadata.selected_claim_id, targetReservationId);
      }
      if (metadata.selected_promo_id && Number(metadata.promo_discount) > 0) {
        await recordPromotionRedemptionAction({
          promotion_id: metadata.selected_promo_id,
          promotion_name: "PayMongo Online Promotion",
          promotion_type: "fixed_amount",
          customer_id: metadata.customer_id || null,
          customer_name: metadata.customer_name,
          customer_email: metadata.customer_email,
          order_id: targetReservationId,
          discount_amount: Number(metadata.promo_discount),
          processed_by: "PayMongo Gateway",
        });
      }
    } catch (promoErr) {
      console.warn("Promotion record warning:", promoErr);
    }

    // 11. Create in-app notifications
    try {
      await supabase.from("notifications").insert([
        {
          user_id: null,
          type: "payment",
          title: "New Online Payment Received",
          message: `${metadata.customer_name || "Guest"} paid ₱${amountPaidPhp.toLocaleString()} via PayMongo (${paymentSourceType.toUpperCase()}) for reservation on ${metadata.date} at ${metadata.time}. Status: Confirmed.`,
          read: false,
        },
      ]);

      if (metadata.customer_id) {
        await supabase.from("notifications").insert([
          {
            user_id: metadata.customer_id,
            type: "payment",
            title: "Reservation Confirmed! 🎉",
            message: `Your payment of ₱${amountPaidPhp.toLocaleString()} via PayMongo was successfully processed. Your reservation is confirmed!`,
            read: false,
          },
        ]);
      }
    } catch (notifErr) {
      console.warn("Notification insert warning:", notifErr);
    }

    // 12. Dispatch confirmation email with official receipt
    try {
      await sendReservationConfirmationEmailAction(targetReservationId);
    } catch (emailErr) {
      console.warn("Email confirmation dispatch warning:", emailErr);
    }

    // 13. Clear pending session cookies from cookie store
    try {
      const cookieStore = await cookies();
      cookieStore.delete("paymongo_pending_session_id");
      cookieStore.delete("paymongo_pending_reservation_id");
    } catch (e) {
      // In webhook context where response cookies cannot be modified, ignore
    }

    revalidatePath("/admin/reservations");
    revalidatePath("/manager/reservations");
    revalidatePath("/admin");
    revalidatePath("/profile");

    return {
      success: true,
      reservationId: targetReservationId,
      reservation: newReservation,
      paymentDetails: {
        paymentId,
        method: paymentSourceType,
        amount: amountPaidPhp,
        status: "verified",
      },
    };
  } catch (err: any) {
    console.error("Error in verifyAndFinalizePayMongoReservationAction:", err);
    return { success: false, error: err?.message || "Failed to finalize reservation payment." };
  }
}

/**
 * Reads pending PayMongo session information from the cookie store.
 */
export async function getPendingSessionCookieAction() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("paymongo_pending_session_id")?.value || null;
    const reservationId = cookieStore.get("paymongo_pending_reservation_id")?.value || null;
    return { sessionId, reservationId };
  } catch (e) {
    return { sessionId: null, reservationId: null };
  }
}

/**
 * Clears pending PayMongo session cookies from the cookie store.
 */
export async function clearPendingSessionCookieAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("paymongo_pending_session_id");
    cookieStore.delete("paymongo_pending_reservation_id");
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
