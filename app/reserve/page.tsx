"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Utensils,
  Mic2,
  Circle,
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  CreditCard,
  Banknote,
  Upload,
  ChevronRight,
  Info,
  Loader2,
  X,
  UtensilsCrossed,
  ChevronDown,
  Plus,
  Minus,
  ExternalLink,
  Printer,
  Download,
  Mail,
  Sparkles,
  Tag,
  Percent,
  Cake,
  Flame,
  Package,
  ShieldCheck,
  AlertTriangle,
  DollarSign
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { validateAndDeductStockAction } from "@/app/actions/menu";
import { sendReservationConfirmationEmailAction } from "@/app/actions/reservationEmail";
import { createPayMongoCheckoutSessionAction } from "@/app/actions/paymongo";
import {
  getCustomerPromotionClaimsAction,
  applyPromotionToReservationAction,
  PromotionClaimRecord,
  Promotion,
  getPromotionsAction,
  evaluateOrderPromotionsAction,
  recordPromotionRedemptionAction,
  OrderPromotionEvaluationResult
} from "@/app/actions/promotions";

type PaymentMethod = "paymongo" | "cash";
type Step = "form" | "checking" | "slots" | "payment" | "success";

export default function ReservePage() {
  const router = useRouter();
  const supabase = createClient();
  const [settings, setSettings] = useState<any>({});
  const [services, setServices] = useState<any[]>([]);

  // Form states
  const [selectedType, setSelectedType] = useState("dining");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [membership, setMembership] = useState("Member");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pickedServiceId, setPickedServiceId] = useState<string>("");
  const [reservationId, setReservationId] = useState<string>("");

  // Menu pre-selection & Stock
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Record<string, number>>({}); // menuItemId -> qty
  const [menuOpen, setMenuOpen] = useState(false);

  // Promotions & Billing Integration
  const [approvedClaims, setApprovedClaims] = useState<PromotionClaimRecord[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");
  const [selectedBundle, setSelectedBundle] = useState<Promotion | null>(null);
  const [userDob, setUserDob] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<OrderPromotionEvaluationResult | null>(null);

  // Payment states
  const [payment, setPayment] = useState<PaymentMethod>("paymongo");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedReservation, setCompletedReservation] = useState<any>(null);
  
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  useEffect(() => {
    // 1. Instant auth verification (starts immediately, doesn't wait for catalogs)
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCustomerId(user.id);
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          if (profile) {
            setName(`${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim());
            setEmail(profile.email ?? "");
            setPhone(profile.phone ?? "");
            setMembership(profile.role === "vip" ? "VIP" : "Member");
            if (profile.dob) setUserDob(profile.dob);
          }
          // Fetch approved promo claims for billing integration
          getCustomerPromotionClaimsAction(user.id).then((claims) => {
            const approved = claims.filter(c => c.status === "approved");
            setApprovedClaims(approved);

            if (typeof window !== "undefined") {
              const params = new URLSearchParams(window.location.search);
              const claimIdParam = params.get("claim_id");
              if (claimIdParam && approved.some(c => c.id === claimIdParam)) {
                setSelectedClaimId(claimIdParam);
              }
            }
          }).catch(console.error);
        }
      } catch (e) {
        console.error("Auth check error in reserve page:", e);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();

    // 2. Fetch services, settings, and promotions
    const fetchData = async () => {
      const { data: setts } = await supabase.from("settings").select("*");
      if (setts) {
        const s: any = {};
        setts.forEach(r => s[r.key] = r.value);
        setSettings(s);
      }

      const { data: svcs } = await supabase.from("services").select("*").eq("status", "available");
      if (svcs) setServices(svcs);

      const { data: menu } = await supabase.from("menu_items").select("*").eq("available", true).order("sort_order");
      if (menu) setMenuItems(menu);

      // Load active promotions
      try {
        const promos = await getPromotionsAction(false);
        setActivePromotions(promos);

        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const promoParam = params.get("promo_id");
          if (promoParam) {
            const matched = promos.find(p => p.id === promoParam);
            if (matched) {
              if (matched.type === "bundle") {
                setSelectedBundle(matched);
                setMenuOpen(true);
              } else {
                setSelectedPromoId(matched.id);
              }
            }
          }
          if (params.get("payment_cancelled") === "true") {
            toast("Payment was cancelled. You can complete your reservation whenever you're ready.", { icon: "ℹ️" });
          }
        }
      } catch (e) {
        console.error("Error loading active promotions for reserve page:", e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showReceiptModal) {
        setShowReceiptModal(false);
      }
    };
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "CLOSE_RECEIPT_MODAL") {
        setShowReceiptModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("message", handleMessage);
    };
  }, [showReceiptModal]);

  const serviceOptions = [
    { id: "dining", label: "Fine Dining", icon: <Utensils size={24} />, desc: "Reserve a table for an elegant meal" },
    { id: "karaoke", label: "Karaoke Room", icon: <Mic2 size={24} />, desc: "Book a private karaoke suite" },
    { id: "billiards", label: "Billiard Table", icon: <Circle size={24} />, desc: "Reserve a premium billiard table" },
  ];
  const selectedServiceType = serviceOptions.find(s => s.id === selectedType);
  const availableSlots = services.filter(s => s.type === selectedType && s.capacity >= guests);
  const pickedService = services.find(s => s.id === pickedServiceId);

  const decGuests = () => setGuests(g => Math.max(1, g - 1));
  const incGuests = () => setGuests(g => Math.min(99, g + 1));

  // Calculations & Pricing Engine
  const baseItems = Object.entries(selectedMenu)
    .filter(([_, q]) => q > 0)
    .map(([id, qty]) => {
      const item = menuItems.find(m => m.id === id);
      return {
        menu_item_id: id,
        name: item?.name || "Item",
        category: item?.category || "",
        price: Number(item?.price || 0),
        quantity: qty
      };
    });

  const bundleCharge = selectedBundle ? selectedBundle.bundle_price : 0;
  const serviceCharge = pickedService?.hourly_rate || 0;
  const regularMenuTotal = baseItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const menuTotal = regularMenuTotal + bundleCharge;
  const rawSubtotal = serviceCharge + menuTotal;

  // Server-side promotion evaluation
  useEffect(() => {
    async function evaluate() {
      try {
        const res = await evaluateOrderPromotionsAction({
          cartItems: baseItems,
          serviceFee: serviceCharge + bundleCharge,
          selectedPromotionId: selectedPromoId || null,
          customerId,
          customerDob: userDob,
        });
        setEvalResult(res);
      } catch (err) {
        console.error("Evaluation error:", err);
      }
    }
    evaluate();
  }, [selectedMenu, pickedServiceId, selectedPromoId, selectedBundle, customerId, userDob]);

  const selectedClaim = approvedClaims.find(c => c.id === selectedClaimId);
  const claimDiscount = selectedClaim ? Math.round((rawSubtotal * selectedClaim.discount_percent) / 100) : 0;
  const promoDiscount = evalResult?.appliedDiscount !== undefined ? evalResult.appliedDiscount : claimDiscount;
  const totalAmountDue = Math.max(0, rawSubtotal - promoDiscount);



  const handleCheckAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) {
      toast.loading("Verifying your account session...", { id: "reserve-auth-check" });
      return;
    }
    if (!customerId) {
      toast.error("Please sign in or register to make a reservation.", { icon: "🔒" });
      router.push("/login?redirect=/reserve");
      return;
    }
    if (!date || !name || !email) return;

    if (date <= todayStr) {
      toast.error("Advance booking is required. Same-day reservations are invalid. Please choose a date starting tomorrow.");
      return;
    }

    setStep("checking");
    setTimeout(() => {
      setStep("slots");
      setTimeout(() => document.getElementById("slots-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    }, 1000);
  };

  const handleSelectSlot = (serviceId: string, slotTime: string) => {
    setPickedServiceId(serviceId);
    setTime(slotTime || "19:00"); 
    setStep("payment");
    setTimeout(() => document.getElementById("payment-section")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleMakePayment = async () => {
    if (!customerId) {
      toast.error("Please sign in before completing your booking.");
      router.push("/login?redirect=/reserve");
      return;
    }

    if (date <= todayStr) {
      toast.error("Advance booking is required. Same-day reservations are not accepted. Please choose a date at least 1 day in advance.");
      return;
    }

    setSubmittingPayment(true);
    try {
      // 1. Prepare items for stock validation & deduction (including Bundle constituent items)
      const regularPreOrdered = Object.entries(selectedMenu)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const m = menuItems.find(it => it.id === id);
          return {
            menu_item_id: id,
            name: m?.name || "Item",
            quantity: qty,
            price: Number(m?.price || 0),
          };
        });

      const itemsToDeduct = regularPreOrdered.map(it => ({ menu_item_id: it.menu_item_id, quantity: it.quantity }));
      if (selectedBundle && selectedBundle.bundle_items) {
        selectedBundle.bundle_items.forEach((b) => {
          const existing = itemsToDeduct.find((it) => it.menu_item_id === b.menu_item_id);
          if (existing) {
            existing.quantity += b.quantity;
          } else {
            itemsToDeduct.push({ menu_item_id: b.menu_item_id, quantity: b.quantity });
          }
        });
      }

      // Validate stock before proceeding
      if (itemsToDeduct.length > 0) {
        const stockCheck = await validateAndDeductStockAction(itemsToDeduct);
        if (!stockCheck.success) {
          toast.error(stockCheck.error || "Some selected menu or bundle items exceed available stock.");
          setSubmittingPayment(false);
          return;
        }
      }

      // Determine service info with fallback for Main Dining
      const currentService = pickedService || services.find(s => s.id === pickedServiceId) || services.find(s => s.type === selectedType);
      const effectiveServiceId = pickedServiceId || currentService?.id || null;
      const effectiveServiceName = currentService?.name || (selectedType === "dining" ? "Main Dining Area" : selectedServiceType?.label || "Bistro Reservation");

      // Construct detailed notes snapshot
      const notesParts: string[] = [`Membership: ${membership}`];
      if (selectedBundle) {
        notesParts.push(`[Bundle: ${selectedBundle.name} (₱${selectedBundle.bundle_price.toLocaleString()})]`);
      }
      if (evalResult?.selectedPromotion) {
        notesParts.push(`[Promo: ${evalResult.selectedPromotion.name} (-₱${promoDiscount.toLocaleString()})]`);
      } else if (selectedClaim) {
        notesParts.push(`[Voucher: ${selectedClaim.promotion_title} (-₱${promoDiscount.toLocaleString()})]`);
      }
      const notes = notesParts.join(" | ");

      // A. ONLINE PAYMENT VIA PAYMONGO GATEWAY
      if (payment === "paymongo" && totalAmountDue > 0) {
        const clientOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
        toast.loading("Connecting to PayMongo Secure Gateway...", { id: "paymongo-loading" });

        const checkoutRes = await createPayMongoCheckoutSessionAction({
          customerId,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          serviceId: effectiveServiceId,
          serviceName: effectiveServiceName,
          serviceType: selectedType,
          date,
          time,
          guests,
          membership,
          notes,
          totalAmount: totalAmountDue,
          rawSubtotal,
          promoDiscount,
          selectedPromoId,
          selectedClaimId,
          selectedBundleId: selectedBundle?.id || null,
          menuItemsToDeduct: itemsToDeduct,
          clientOrigin,
        });

        toast.dismiss("paymongo-loading");

        if (!checkoutRes.success || !checkoutRes.checkoutUrl) {
          toast.error(checkoutRes.error || "Failed to initialize PayMongo checkout. Please try again.");
          setSubmittingPayment(false);
          return;
        }

        if (typeof window !== "undefined") {
          if (checkoutRes.sessionId) {
            sessionStorage.setItem("paymongo_session_id", checkoutRes.sessionId);
            localStorage.setItem("paymongo_session_id", checkoutRes.sessionId);
          }
          if (checkoutRes.reservationId) {
            sessionStorage.setItem("paymongo_reservation_id", checkoutRes.reservationId);
            localStorage.setItem("paymongo_reservation_id", checkoutRes.reservationId);
          }
        }

        toast.success("Redirecting to PayMongo Secure Gateway...", { icon: "🔒", duration: 3000 });
        window.location.href = checkoutRes.checkoutUrl;
        return;
      }

      // B. CASH ON ARRIVAL OR ZERO-BALANCE RESERVATION
      const newResId = crypto.randomUUID();

      const { error: resError } = await supabase.from("reservations").insert([{
        id: newResId,
        customer_id: customerId,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        service_id: effectiveServiceId,
        date,
        time_start: time,
        guests,
        status: settings.auto_approve === "true" ? "confirmed" : "pending",
        total_amount: totalAmountDue,
        notes: `${notes} | [Payment: ${totalAmountDue === 0 ? "Free / Promo Covered" : "Cash on Arrival"}]`.trim(),
      }]);

      if (resError) throw resError;

      // Ensure payment record exists
      await supabase.from("payments").insert([{
        reservation_id: newResId,
        method: "cash",
        amount: totalAmountDue,
        status: totalAmountDue === 0 ? "verified" : "pending"
      }]);

      // Save complete snapshot for popup modal and in-page notice
      setCompletedReservation({
        id: newResId,
        serviceName: effectiveServiceName,
        serviceType: selectedType,
        date,
        time,
        guests,
        totalAmount: totalAmountDue,
        paymentMethod: "cash",
        email,
        name,
      });

      // Transition to success screen
      setReservationId(newResId);
      setStep("success");
      setShowSuccessModal(true);
      toast.success("Reservation submitted successfully!", { icon: "🎉", duration: 4000 });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setTimeout(() => document.getElementById("reservation-success")?.scrollIntoView({ behavior: "smooth" }), 100);

      // Auxiliary background operations
      try {
        if (itemsToDeduct.length > 0) {
          const menuRows = itemsToDeduct.map((it) => ({
            reservation_id: newResId,
            menu_item_id: it.menu_item_id,
            quantity: it.quantity,
          }));
          await supabase.from("reservation_menu").insert(menuRows);
        }

        if (evalResult?.selectedPromotion && promoDiscount > 0) {
          await recordPromotionRedemptionAction({
            promotion_id: evalResult.selectedPromotion.id,
            promotion_name: evalResult.selectedPromotion.name,
            promotion_type: evalResult.selectedPromotion.type,
            customer_id: customerId,
            customer_name: name,
            customer_email: email,
            order_id: newResId,
            discount_amount: promoDiscount,
            processed_by: "Customer Self-Checkout",
            verified_birthday: evalResult.selectedPromotion.type === "birthday",
          });
        }

        if (selectedClaimId) {
          await applyPromotionToReservationAction(selectedClaimId, newResId);
        }

        await supabase.from("notifications").insert([{
          user_id: null,
          type: "reservation",
          title: "New Reservation Received",
          message: `${name} has submitted a reservation for ${date} at ${time}. Total: ₱${totalAmountDue.toLocaleString()}.`,
          read: false,
        }]);

        if (customerId) {
          await supabase.from("notifications").insert([{
            user_id: customerId,
            type: "reservation",
            title: "Reservation Received",
            message: `Your reservation for ${date} at ${time} has been received. Total: ₱${totalAmountDue.toLocaleString()}.`,
            read: false,
          }]);
        }
      } catch (auxErr) {
        console.warn("Non-critical post-reservation tasks encountered an issue:", auxErr);
      }

      // Send customer confirmation email with booking summary and receipt
      try {
        await sendReservationConfirmationEmailAction(newResId);
      } catch (emailErr: any) {
        console.warn("Failed to dispatch confirmation email:", emailErr);
      }
    } catch (err: any) {
      console.error("Reservation submission error:", err);
      toast.error(err.message || "Failed to make reservation. Please try again.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancel = () => {
    setStep("form");
    setPickedServiceId("");
    setSelectedMenu({});
    setSelectedClaimId("");
    setMenuOpen(false);
    setShowSuccessModal(false);
    setCompletedReservation(null);
  };

  const MENU_CATS = ["Beverages", "Pulutan", "Also Available"];

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Navbar />
      <Toaster position="top-right" />

      {/* Hero */}
      <div className="relative pt-[68px] overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80')" }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.93)] via-[rgba(107,16,32,0.85)] to-[rgba(30,5,10,0.95)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-[0.78rem] tracking-[0.2em] uppercase text-gold font-semibold mb-3">Limited Seats Available</p>
          <h1 className="font-playfair text-[clamp(2.2rem,5vw,3.6rem)] font-bold text-white leading-[1.15] mb-4">Make a Reservation</h1>
          <p className="text-white/70 text-sm max-w-[480px] mx-auto leading-[1.8]">Book your table, karaoke suite, or billiard table in minutes.</p>
        </div>
      </div>

      <div className="max-w-[1060px] mx-auto px-5 py-14 space-y-10">
        
        {/* SUCCESS */}
        {step === "success" && (
          <div id="reservation-success" className="max-w-[520px] mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mx-auto mb-6 shadow-lg">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="font-playfair text-3xl font-bold text-[#3d0a14] mb-3">Reservation Submitted!</h2>
            <p className="text-gray-500 text-base leading-[1.8] mb-4">
              Thank you, <strong>{name}</strong>! Your <strong>{completedReservation?.serviceName || pickedService?.name || (selectedType === "dining" ? "Main Dining Area" : selectedServiceType?.label || "Bistro")}</strong> reservation on <strong>{date}</strong> at <strong>{time}</strong> for <strong>{guests}</strong> guest(s) has been received.
            </p>
            {payment === "cash" && settings.auto_approve !== "true" && (
              <p className="text-amber-700 text-sm font-semibold mb-8 bg-amber-50 p-4 rounded-xl border border-amber-200">
                Since you opted for Pay on Arrival (No Downpayment), your reservation is subject to manager confirmation.
              </p>
            )}
            {payment === "paymongo" && (
              <p className="text-green-700 text-sm font-semibold mb-6 bg-green-50 p-4 rounded-xl border border-green-200">
                Payment verified via PayMongo! {settings.auto_approve !== "true" && "We will confirm shortly."}
              </p>
            )}

            {/* Email Confirmation Notice */}
            <div className="bg-[#fcfaf7] border border-[#e5d3a1] rounded-2xl p-5 mb-8 text-left shadow-sm">
              <div className="flex items-center gap-2.5 text-[#3d0a14] font-bold text-sm mb-2">
                <Mail size={18} className="text-[#c9a84c]" />
                <span>Booking Summary &amp; Receipt Sent!</span>
              </div>
              <p className="text-gray-600 text-xs leading-relaxed">
                A complete booking confirmation along with your official receipt details have been sent to{" "}
                <strong className="text-gray-900">{email || "your email address"}</strong>.
              </p>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => setShowReceiptModal(true)}
                className="bg-[#3d0a14] text-gold px-7 py-3.5 rounded-xl font-semibold text-sm tracking-wide hover:bg-[#6b1020] transition-all flex items-center gap-2 shadow-sm"
              >
                <span>View Receipt</span>
              </button>
              {reservationId && (
                <a
                  href={`/receipt/${reservationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#c9a84c] text-[#3d0a14] px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide hover:bg-[#b8953d] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Printer size={15} />
                  <span>Print Official Receipt</span>
                </a>
              )}
              <button
                onClick={handleCancel}
                className="border border-[#3d0a14] text-[#3d0a14] px-7 py-3.5 rounded-xl font-semibold text-sm tracking-wide hover:bg-[#3d0a14] hover:text-white transition-all"
              >
                Make Another Booking
              </button>
            </div>
          </div>
        )}

        {step !== "success" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              
              {/* STEP 1: Main Form */}
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(61,10,20,0.08)] border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-100 px-8 pt-8 pb-0">
                  <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-gray-400 mb-3">Select Service</p>
                  <div className="flex gap-0">
                    {serviceOptions.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelectedType(s.id); setStep("form"); setPickedServiceId(""); }}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${selectedType === s.id ? "border-gold text-[#3d0a14]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                      >
                        <div className={selectedType === s.id ? "text-[#3d0a14]" : "text-gray-400"}>{s.icon}</div>
                        <span className="text-[0.72rem]">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCheckAvailability} className="px-8 py-7 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Full Name *</label>
                      <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Email *</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none" />
                    </div>
                  </div>

                  {!authLoading && !customerId && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div>
                        <p className="font-bold flex items-center gap-1.5">
                          <Info size={16} className="text-amber-700" />
                          Sign In Required
                        </p>
                        <p className="text-xs text-amber-800 mt-0.5">Please sign in to your customer account to submit a reservation.</p>
                      </div>
                      <Link href="/login?redirect=/reserve" className="px-4 py-2 bg-[#3d0a14] text-gold font-bold text-xs rounded-xl hover:bg-[#5c1020] transition-colors text-center whitespace-nowrap">
                        Sign In / Register
                      </Link>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Membership Tier</label>
                    <div className="flex gap-4">
                      {["Member", "VIP"].map((tier) => (
                        <label key={tier} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="radio" 
                            name="membership" 
                            value={tier} 
                            checked={membership === tier}
                            onChange={(e) => setMembership(e.target.value)}
                            className="accent-gold w-4 h-4"
                          />
                          <span className={membership === tier ? "font-bold text-[#3d0a14]" : "text-gray-600"}>{tier}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Date (Advance Booking Only) *</label>
                    <div className="relative">
                      <CalendarDays size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="date" 
                        required 
                        min={tomorrowStr} 
                        value={date} 
                        onChange={e => { 
                          const val = e.target.value;
                          if (val && val <= todayStr) {
                            toast.error("Advance booking is required. Same-day reservations are not accepted. Please select tomorrow or a later date.");
                            setDate("");
                            return;
                          }
                          setDate(val); 
                          setStep("form"); 
                        }} 
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none text-gray-600" 
                      />
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1.5 flex items-center gap-1 font-medium bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/50">
                      <Clock size={12} className="text-amber-700 shrink-0" />
                      <span>Advance booking required: Same-day reservations are invalid. Please book at least 1 day in advance.</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Time</label>
                    <div className="relative">
                      <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="time" required value={time} onChange={e => { setTime(e.target.value); setStep("form"); }} className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-[#fafafa] focus:border-gold outline-none text-gray-600" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Number of Guests</label>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={decGuests} className="w-10 h-10 rounded-xl border-2 border-gold text-gold flex items-center justify-center font-bold text-xl hover:bg-gold hover:text-white transition-colors">−</button>
                      <div className="flex items-center gap-3">
                        <Users size={24} className="text-[#6b1020]" />
                        <span className="font-playfair text-3xl font-bold text-[#3d0a14] min-w-[2rem] text-center">{guests}</span>
                      </div>
                      <button type="button" onClick={incGuests} className="w-10 h-10 rounded-xl border-2 border-gold text-gold flex items-center justify-center font-bold text-xl hover:bg-gold hover:text-white transition-colors">+</button>
                    </div>
                  </div>

                  <button type="submit" disabled={step === "checking" || authLoading} className="w-full bg-gold text-[#3d0a14] font-bold py-3.5 rounded-xl text-sm hover:bg-[#e2c46a] transition-all shadow-[0_3px_14px_rgba(201,168,76,0.3)] disabled:opacity-60 flex items-center justify-center gap-2">
                    {authLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#3d0a14]/30 border-t-[#3d0a14] rounded-full animate-spin" />
                        <span>Verifying Account...</span>
                      </>
                    ) : step === "checking" ? (
                      "Checking Availability..."
                    ) : (
                      "✦ Check Availability"
                    )}
                  </button>
                </form>
              </div>

              {/* STEP 2: Available Slots */}
              {(step === "slots" || step === "payment") && (
                <div id="slots-section" className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(61,10,20,0.08)] border border-gray-100 p-8">
                  <h2 className="font-playfair text-xl font-bold text-[#3d0a14] mb-4">Available {selectedServiceType?.label}</h2>
                  {availableSlots.length === 0 ? (
                    <p className="text-gray-500 text-sm">Sorry, no available options for this category and capacity right now.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {availableSlots.map(s => (
                        <div key={s.id} onClick={() => handleSelectSlot(s.id, time)} className={`cursor-pointer rounded-xl p-5 border-2 transition-all ${pickedServiceId === s.id ? "bg-green-50 border-green-400 shadow-md" : "bg-white border-gray-100 hover:border-green-300 hover:shadow-md"}`}>
                          <div className="flex justify-between mb-2">
                            <span className="font-bold text-sm text-gray-800">{s.name}</span>
                            {pickedServiceId === s.id && <CheckCircle2 size={18} className="text-green-500" />}
                          </div>
                          {s.description && (
                            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{s.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mb-1">Capacity: {s.capacity} pax</p>
                          <p className="text-xs font-bold text-[#6b1020]">₱{s.hourly_rate}/hr</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Payment Options */}
              {step === "payment" && (
                <div id="payment-section" className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(61,10,20,0.08)] border border-gray-100 p-8">
                  <h2 className="font-playfair text-xl font-bold text-[#3d0a14] mb-1">Complete Your Booking</h2>
                  <p className="text-gray-400 text-xs mb-6">Securing reservation for {pickedService?.name || "Jbenz Bistro"}</p>

                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => setPayment("paymongo")}
                      className={`flex-1 py-3.5 px-4 border-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                        payment === "paymongo"
                          ? "border-emerald-500 text-emerald-800 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500/30"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <CreditCard size={18} className="text-emerald-600" />
                      <span className="flex items-center gap-2">
                        <span>PayMongo Online Gateway</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayment("cash")}
                      className={`flex-1 py-3.5 px-4 border-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        payment === "cash"
                          ? "border-amber-500 text-amber-900 bg-amber-50/80 shadow-xs ring-1 ring-amber-500/30"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <Banknote size={18} className="text-amber-700" />
                      <span>Pay on Arrival (Cash)</span>
                    </button>
                  </div>

                  {payment === "paymongo" && (
                    <div className="bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/40 border border-emerald-200/90 rounded-2xl p-5 sm:p-6 mb-6 space-y-5 shadow-xs">
                      {/* Header with security badge */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                            <ShieldCheck size={22} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                              PayMongo Payment Gateway                            
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Seamless checkout with instant automated booking confirmation &amp; official receipt
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                            Total Due
                          </span>
                          <span className="text-xl font-black text-[#8b1327]">
                            ₱{totalAmountDue.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Payment Channels Grid */}
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                          Supported Payment Methods
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="bg-white border border-gray-200/90 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs hover:border-blue-400 transition-colors">
                            <span className="text-xs font-black text-blue-600 tracking-tight">GCash</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">E-Wallet</span>
                          </div>
                          <div className="bg-white border border-gray-200/90 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs hover:border-emerald-400 transition-colors">
                            <span className="text-xs font-black text-emerald-600 tracking-tight">Maya</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">E-Wallet / Maya</span>
                          </div>
                          <div className="bg-white border border-gray-200/90 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs hover:border-purple-400 transition-colors">
                            <span className="text-xs font-black text-gray-800 tracking-tight">Cards</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">Visa · Mastercard · JCB</span>
                          </div>
                          <div className="bg-white border border-gray-200/90 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs hover:border-amber-400 transition-colors">
                            <span className="text-xs font-black text-amber-700 tracking-tight">Online Bank</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">BPI · Direct Bank</span>
                          </div>
                        </div>
                      </div>

                      {/* Test Mode Note */}
                      <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                        <Info size={14} className="text-amber-700 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-relaxed">
                          <strong>Test Environment:</strong> You can select GCash, Maya, or Card on PayMongo checkout and simulate an authorized payment with standard PayMongo test OTP / authorization.
                        </span>
                      </div>
                    </div>
                  )}

                  {payment === "cash" && (
                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 mb-6 space-y-2">
                      <h4 className="font-bold text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Banknote size={15} className="text-amber-700" /> Pay in Cash on Arrival
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Pay the full balance of <strong>₱{totalAmountDue.toLocaleString()}</strong> upon arriving at Jbenz Bistro.
                        Your table reservation will be held for up to 15 minutes past your scheduled time.
                      </p>
                    </div>
                  )}

                  {/* PROMOTIONS & VOUCHERS SECTION */}
                  <div className="border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/60 rounded-2xl p-4 sm:p-5 mb-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#3d0a14] text-gold flex items-center justify-center shadow-xs">
                          <Tag size={14} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#3d0a14] flex items-center gap-1.5">
                            Promotions & Discounts
                            {activePromotions.length > 0 && (
                              <span className="text-[10px] bg-[#c9a84c] text-[#3d0a14] font-extrabold px-2 py-0.5 rounded-full">
                                {activePromotions.length} Available
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-gray-500">
                            Select an eligible promotion or apply your approved voucher to your booking.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Active Promotions List */}
                    {activePromotions.filter(p => p.type !== "bundle").length > 0 && (
                      <div className="space-y-2">
                        {activePromotions.filter(p => p.type !== "bundle").map((promo) => {
                          const evalItem = evalResult?.eligiblePromotions?.find(e => e.promotion.id === promo.id);
                          const isEligible = evalItem?.eligible ?? true;
                          const isSelected = selectedPromoId === promo.id;

                          return (
                            <div
                              key={promo.id}
                              className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isSelected
                                  ? "bg-amber-100/60 border-[#c9a84c] shadow-xs ring-1 ring-[#c9a84c]"
                                  : isEligible
                                  ? "bg-white border-amber-200/60 hover:border-amber-300"
                                  : "bg-gray-50/60 border-gray-200 opacity-60"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="px-2.5 py-1 rounded-md bg-[#3d0a14] text-gold font-extrabold text-xs tracking-wider flex-shrink-0 flex items-center gap-1">
                                  {promo.type === "percentage" && <Percent size={11} />}
                                  {promo.type === "fixed_amount" && <DollarSign size={11} />}
                                  {promo.type === "happy_hour" && <Flame size={11} />}
                                  {promo.type === "birthday" && <Cake size={11} />}
                                  <span>
                                    {promo.type === "percentage"
                                      ? `${promo.discount_percent}% OFF`
                                      : promo.type === "fixed_amount"
                                      ? `₱${promo.discount_amount} OFF`
                                      : promo.type === "happy_hour"
                                      ? `${promo.discount_percent}% HH`
                                      : "BDAY"}
                                  </span>
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-gray-900 leading-snug">
                                    {promo.name}
                                  </h5>
                                  <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                                    {promo.description}
                                  </p>
                                  {/* Eligibility Guidance */}
                                  {!isEligible && evalItem?.reason ? (
                                    <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-1">
                                      <AlertTriangle size={11} /> {evalItem.reason}
                                    </span>
                                  ) : evalItem?.savingsBreakdown ? (
                                    <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
                                      <CheckCircle2 size={11} /> {evalItem.savingsBreakdown}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={!isEligible && !isSelected}
                                onClick={() => {
                                  setSelectedClaimId(""); // mutually exclusive with legacy claims
                                  setSelectedPromoId(isSelected ? "" : promo.id);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                  isSelected
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : isEligible
                                    ? "bg-[#3d0a14] text-gold hover:bg-[#5c1020]"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <CheckCircle2 size={13} />
                                    <span>Applied</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={13} />
                                    <span>Apply Offer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Approved Claims Section (Backward Compatible) */}
                    {approvedClaims.length > 0 && (
                      <div className="pt-2 border-t border-amber-200/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Your Approved Vouchers
                        </p>
                        <div className="space-y-2">
                          {approvedClaims.map((claim) => {
                            const isSelected = selectedClaimId === claim.id;
                            return (
                              <div
                                key={claim.id}
                                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isSelected
                                    ? "bg-amber-100/50 border-[#c9a84c] shadow-xs"
                                    : "bg-white border-amber-200/60 hover:border-amber-300"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="px-2.5 py-1 rounded-md bg-[#3d0a14] text-gold font-extrabold text-xs tracking-wider flex-shrink-0">
                                    {claim.discount_percent}% OFF
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-bold text-gray-900 leading-snug">
                                      {claim.promotion_title}
                                    </h5>
                                    <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                                      <CheckCircle2 size={11} className="text-emerald-600" />
                                      Approved Voucher
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPromoId("");
                                    setSelectedClaimId(isSelected ? "" : claim.id);
                                  }}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                    isSelected
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                      : "bg-[#3d0a14] text-gold hover:bg-[#5c1020]"
                                  }`}
                                >
                                  {isSelected ? "Voucher Applied" : "Use Voucher"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Applied Rule Explanation Note */}
                    {evalResult?.ruleExplanation && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-relaxed">{evalResult.ruleExplanation}</span>
                      </div>
                    )}
                  </div>

                  {/* Optional Menu Pre-selection with Stock Validation & Bundles */}
                  <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(o => !o)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-amber-50/60 hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <UtensilsCrossed size={16} className="text-amber-700" />
                        <span className="text-sm font-semibold text-gray-700">Pre-select Menu Items &amp; Bundles</span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Optional</span>
                        {(Object.values(selectedMenu).some(q => q > 0) || selectedBundle) && (
                          <span className="text-[10px] bg-[#3d0a14] text-gold font-bold px-2 py-0.5 rounded-full">
                            {selectedBundle ? "1 Bundle + " : ""}{Object.values(selectedMenu).reduce((s, q) => s + q, 0)} items
                          </span>
                        )}
                      </div>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {menuOpen && (
                      <div className="p-4 bg-white space-y-5">
                        <p className="text-xs text-gray-400 -mt-1">
                          Pre-order items or select an exclusive bundle. Subject to real-time kitchen inventory.
                        </p>

                        {/* Bundles Section */}
                        {activePromotions.filter(p => p.type === "bundle").length > 0 && (
                          <div className="p-4 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={14} className="text-amber-800" /> Promotional Meal Bundles
                              </span>
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                                Best Value
                              </span>
                            </div>

                            <div className="space-y-3">
                              {activePromotions.filter(p => p.type === "bundle").map(bundle => {
                                const isSelected = selectedBundle?.id === bundle.id;
                                // Check stock of all constituent items
                                const outOfStockItem = bundle.bundle_items.find(b => {
                                  const m = menuItems.find(it => it.id === b.menu_item_id);
                                  return (m?.stock ?? 50) < b.quantity;
                                });

                                return (
                                  <div
                                    key={bundle.id}
                                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                      isSelected
                                        ? "bg-amber-100/60 border-[#c9a84c] shadow-xs ring-1 ring-[#c9a84c]"
                                        : "bg-white border-amber-200/80 hover:border-amber-300"
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <h5 className="font-bold text-xs text-gray-900">{bundle.name}</h5>
                                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                          ₱{bundle.bundle_price.toLocaleString()}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-gray-500">
                                        {bundle.bundle_items.map(b => `${b.quantity}x ${b.name}`).join(", ")}
                                      </p>
                                      {outOfStockItem && (
                                        <span className="text-[10px] text-red-600 font-bold block">
                                          ⚠️ Insufficient stock for {outOfStockItem.name}.
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={!!outOfStockItem}
                                      onClick={() => setSelectedBundle(isSelected ? null : bundle)}
                                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        isSelected
                                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                          : outOfStockItem
                                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                          : "bg-[#3d0a14] text-gold hover:bg-[#5c1020]"
                                      }`}
                                    >
                                      {isSelected ? (
                                        <>
                                          <CheckCircle2 size={13} />
                                          <span>Bundle Added</span>
                                        </>
                                      ) : (
                                        <>
                                          <Plus size={13} />
                                          <span>Add Bundle (₱{bundle.bundle_price.toLocaleString()})</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Individual Menu Categories */}
                        {MENU_CATS.map(cat => {
                          const items = menuItems.filter(m => m.category === cat);
                          if (!items.length) return null;
                          return (
                            <div key={cat}>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <UtensilsCrossed size={10} />{cat}
                              </p>
                              <div className="space-y-2">
                                {items.map(item => {
                                  const qty = selectedMenu[item.id] ?? 0;
                                  const stock = item.stock ?? 50;
                                  const isOutOfStock = stock <= 0;
                                  const isMaxReached = qty >= stock;
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                                      <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-medium text-gray-800">{item.name}</span>
                                          {isOutOfStock ? (
                                            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Out of Stock</span>
                                          ) : stock <= 5 ? (
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Only {stock} left</span>
                                          ) : (
                                            <span className="text-[10px] text-gray-400 font-medium">{stock} available</span>
                                          )}
                                        </div>
                                        <span className="text-xs font-bold text-[#6b1020]">₱{Number(item.price).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedMenu(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }))}
                                          disabled={qty === 0}
                                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-red-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                                        ><Minus size={12} /></button>
                                        <span className={`w-5 text-center text-sm font-bold ${qty > 0 ? "text-[#3d0a14]" : "text-gray-300"}`}>{qty}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isMaxReached) {
                                              toast.error(`Maximum stock reached for ${item.name} (${stock} units)`);
                                              return;
                                            }
                                            setSelectedMenu(prev => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
                                          }}
                                          disabled={isOutOfStock || isMaxReached}
                                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                                            isOutOfStock || isMaxReached
                                              ? "opacity-30 cursor-not-allowed border-gray-200 text-gray-300"
                                              : "border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600"
                                          }`}
                                          title={isOutOfStock ? "Out of stock" : isMaxReached ? `Stock limit reached (${stock} max)` : "Add one"}
                                        ><Plus size={12} /></button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {menuTotal > 0 && (
                          <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-500">Menu Subtotal</span>
                            <span className="font-bold text-[#3d0a14]">₱{menuTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={submittingPayment}
                      onClick={handleMakePayment}
                      className="flex-1 bg-[#3d0a14] text-white font-bold py-3.5 rounded-xl text-sm shadow-[0_3px_14px_rgba(61,10,20,0.25)] hover:bg-[#6b1020] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submittingPayment ? (
                        <>
                          <Loader2 size={16} className="animate-spin text-gold" />
                          <span>{payment === "paymongo" ? "Connecting to PayMongo..." : "Processing Reservation..."}</span>
                        </>
                      ) : payment === "paymongo" ? (
                        totalAmountDue > 0 ? (
                          <>
                            <span>Proceed to PayMongo Checkout (₱{totalAmountDue.toLocaleString()})</span>
                            <ExternalLink size={15} className="text-gold" />
                          </>
                        ) : (
                          "Confirm Free Reservation"
                        )
                      ) : (
                        "Confirm Reservation (Pay on Arrival)"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={submittingPayment}
                      onClick={handleCancel}
                      className="px-6 border-2 border-gray-200 text-gray-400 font-semibold rounded-xl text-sm hover:border-red-300 hover:text-red-400 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR - Order Summary */}
            <div className="space-y-5">
              <div className="bg-[#3d0a14] rounded-2xl p-6 text-white sticky top-24">
                <h3 className="font-playfair text-lg font-bold mb-4">Booking Summary</h3>
                
                <div className="flex items-center gap-2 mb-6">
                  {["form", "slots", "payment"].map((s, i) => {
                    const active = ["form", "slots", "payment", "success"].indexOf(step) >= i;
                    return (
                      <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-gold text-[#3d0a14]" : "bg-white/10 text-white/40"}`}>{i + 1}</div>
                        {i < 2 && <div className={`flex-1 h-0.5 ${["form", "slots", "payment", "success"].indexOf(step) > i ? "bg-gold" : "bg-white/10"}`} />}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60 flex items-center gap-2">Category</span>
                    <span className="font-semibold text-gold capitalize">{selectedType}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Service</span>
                    <span className="font-semibold">{pickedService?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Date</span>
                    <span className="font-semibold">{date || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Time</span>
                    <span className="font-semibold">{time || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Guests</span>
                    <span className="font-semibold">{guests}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-white/60">Membership</span>
                    <span className="font-semibold text-gold">{membership}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-white/80 font-bold">Service Rate</span>
                    <span className="font-bold text-gold text-lg">₱{pickedService?.hourly_rate || 0}</span>
                  </div>

                  {/* Selected menu items preview */}
                  {Object.entries(selectedMenu).some(([, q]) => q > 0) && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Pre-ordered</p>
                      {Object.entries(selectedMenu)
                        .filter(([, qty]) => qty > 0)
                        .map(([id, qty]) => {
                          const item = menuItems.find(m => m.id === id);
                          if (!item) return null;
                          return (
                            <div key={id} className="flex justify-between text-xs mb-1.5">
                              <span className="text-white/60">×{qty} {item.name}</span>
                              <span className="text-gold font-semibold">₱{(item.price * qty).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                        <span className="text-white/60 text-xs">Menu Subtotal</span>
                        <span className="text-gold font-semibold text-xs">₱{menuTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Calculations & Total Breakdown */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex justify-between items-center text-xs text-white/70">
                      <span>Service Rate</span>
                      <span className="font-semibold text-white">₱{(pickedService?.hourly_rate || 0).toLocaleString()}</span>
                    </div>

                    {regularMenuTotal > 0 && (
                      <div className="flex justify-between items-center text-xs text-white/70">
                        <span>Pre-ordered Menu</span>
                        <span className="font-semibold text-white">₱{regularMenuTotal.toLocaleString()}</span>
                      </div>
                    )}

                    {selectedBundle && (
                      <div className="flex justify-between items-center text-xs bg-amber-950/60 border border-amber-500/30 p-2 rounded-xl text-amber-300">
                        <span className="flex items-center gap-1 font-semibold truncate max-w-[170px]">
                          <Package size={11} className="flex-shrink-0" /> {selectedBundle.name}
                        </span>
                        <span className="font-bold text-gold">₱{selectedBundle.bundle_price.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-white/50 pt-1">
                      <span>Subtotal</span>
                      <span>₱{rawSubtotal.toLocaleString()}</span>
                    </div>

                    {/* Applied Discount Line */}
                    {promoDiscount > 0 && (
                      <div className="flex justify-between items-center text-xs bg-emerald-950/60 border border-emerald-500/30 p-2 rounded-xl text-emerald-300">
                        <span className="flex items-center gap-1">
                          <Sparkles size={11} />
                          {evalResult?.selectedPromotion?.name || selectedClaim?.promotion_title || "Promotion Discount"}
                        </span>
                        <span className="font-bold">-₱{promoDiscount.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-white/30 flex justify-between items-center">
                      <span className="text-white font-extrabold text-sm">Grand Total</span>
                      <span className="font-extrabold text-gold text-xl">₱{totalAmountDue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
      <Footer />


      {/* ── Success Popup Modal ── */}
      {showSuccessModal && completedReservation && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#c9a84c]/30 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Luxury Bistro Gradient */}
            <div className="bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] p-6 text-center text-white relative">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              
              <div className="w-16 h-16 rounded-full bg-[#c9a84c]/20 border-2 border-[#c9a84c] flex items-center justify-center text-[#c9a84c] mx-auto mb-3 shadow-lg shadow-black/20">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="font-playfair text-2xl font-bold tracking-tight text-white mb-1">
                Reservation Submitted!
              </h3>
              <p className="text-xs text-[#e5d3a1] uppercase tracking-widest font-semibold">
                Official Booking Notice
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Thank you, <strong className="text-gray-900">{completedReservation.name}</strong>! Your{" "}
                <strong className="text-[#8b1327]">{completedReservation.serviceName}</strong> reservation has been successfully placed.
              </p>

              {/* Booking Snapshot */}
              <div className="bg-[#faf9f6] border border-[#ece6dc] rounded-2xl p-4 text-xs space-y-2.5">
                <div className="flex justify-between items-center text-gray-600">
                  <span className="font-medium flex items-center gap-1.5"><CalendarDays size={13} className="text-[#8b1327]" /> Date</span>
                  <span className="font-bold text-gray-900">{formatDate(completedReservation.date)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span className="font-medium flex items-center gap-1.5"><Clock size={13} className="text-[#8b1327]" /> Time</span>
                  <span className="font-bold text-gray-900">{formatTime(completedReservation.time)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span className="font-medium flex items-center gap-1.5"><Users size={13} className="text-[#8b1327]" /> Party Size</span>
                  <span className="font-bold text-gray-900">{completedReservation.guests} {completedReservation.guests === 1 ? "Guest" : "Guests"}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-800">Total Amount</span>
                  <span className="font-extrabold text-[#8b1327] text-sm">₱{Number(completedReservation.totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Email Sent Notice Card */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-left shadow-xs">
                <div className="flex items-center gap-2 text-[#3d0a14] font-bold text-xs mb-1.5">
                  <Mail size={16} className="text-[#c9a84c]" />
                  <span>Booking Summary &amp; Receipt Sent!</span>
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">
                  A complete booking confirmation and receipt summary have been dispatched to{" "}
                  <strong className="text-gray-900">{completedReservation.email}</strong>.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {reservationId && (
                  <a
                    href={`/receipt/${reservationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#c9a84c] hover:bg-[#b8953d] text-[#3d0a14] py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <Printer size={15} />
                    <span>Print Official Receipt</span>
                  </a>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      setShowReceiptModal(true);
                    }}
                    className="flex-1 bg-[#3d0a14] hover:bg-[#5c1020] text-gold py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>View Receipt</span>
                  </button>
                  <Link
                    href="/profile"
                    className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 py-2.5 rounded-xl font-semibold text-xs text-center transition-colors flex items-center justify-center"
                  >
                    My Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {showReceiptModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowReceiptModal(false)}
        >
          <div
            className="bg-[#e5e7eb] rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
              <h3 className="font-bold text-gray-800 text-sm tracking-wide">Reservation Receipt</h3>
              <div className="flex items-center gap-2">
                <a
                  href={`/receipt/${reservationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#3d0a14] text-gold hover:bg-[#520d1b] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Open full receipt in new tab"
                >
                  <Printer size={13} />
                  <span>Print Receipt</span>
                </a>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative bg-[#e5e7eb]">
              <iframe 
                src={`/receipt/${reservationId}?modal=true`} 
                className="w-full h-full border-none"
                title="Receipt"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
