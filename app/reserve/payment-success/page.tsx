"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  CheckCircle2,
  CalendarDays,
  Clock,
  Users,
  Printer,
  Mail,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  Loader2,
  AlertCircle,
  Home,
  User,
  Sparkles,
} from "lucide-react";
import { verifyAndFinalizePayMongoReservationAction } from "@/app/actions/paymongo";
import { formatDate, formatTime } from "@/lib/dateUtils";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSessionId = searchParams.get("session_id");
  const urlReservationId = searchParams.get("reservation_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    async function verify() {
      if (hasFinishedRef.current) return;

      try {
        setLoading(true);

        // Fallback to storage if query param was literal placeholder or missing
        let activeSessionId = urlSessionId;
        if (!activeSessionId || activeSessionId.includes("{CHECKOUT_SESSION_ID}") || !activeSessionId.startsWith("cs_")) {
          if (typeof window !== "undefined") {
            activeSessionId = sessionStorage.getItem("paymongo_session_id") || localStorage.getItem("paymongo_session_id") || null;
          }
        }

        let activeReservationId = urlReservationId;
        if (!activeReservationId && typeof window !== "undefined") {
          activeReservationId = sessionStorage.getItem("paymongo_reservation_id") || localStorage.getItem("paymongo_reservation_id") || null;
        }

        const res = await verifyAndFinalizePayMongoReservationAction({
          sessionId: activeSessionId,
          reservationId: activeReservationId,
        });

        if (!isMounted) return;

        if (res.success) {
          hasFinishedRef.current = true;
          setReservation(res.reservation);
          setPaymentDetails(res.paymentDetails);
          setError(null);
        } else {
          if (!hasFinishedRef.current) {
            setError(res.error || "Payment verification could not be completed.");
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Verification error:", err);
        if (!hasFinishedRef.current) {
          setError(err?.message || "An unexpected error occurred while verifying your payment.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [urlSessionId, urlReservationId]);

  const reservationId = reservation?.id;
  const resCode = reservation?.reservation_code || (reservationId ? reservationId.slice(0, 8).toUpperCase() : "JBZ");
  const customerName = reservation?.customer_name || "Valued Guest";
  const customerEmail = reservation?.customer_email || "";
  const serviceName = reservation?.services?.name || "Jbenz Bistro Reservation";
  const bookingDate = reservation?.date ? formatDate(reservation.date) : "—";
  const bookingTime = reservation?.time_start ? formatTime(reservation.time_start) : "—";
  const guests = reservation?.guests || 2;
  const totalAmount = Number(reservation?.total_amount || paymentDetails?.amount || 0);
  const paymentMethodLabel = (paymentDetails?.method || "Online Payment").toUpperCase();
  const paymentRef = paymentDetails?.paymentId || "Verified";

  // Breakdown calculations
  const menuItems: any[] = reservation?.reservation_menu || [];
  const menuTotal = menuItems.reduce((sum: number, rm: any) => sum + ((rm.menu_items?.price ?? 0) * (rm.quantity ?? 1)), 0);
  const serviceAmount = reservation?.services?.hourly_rate !== undefined && reservation?.services?.hourly_rate !== null
    ? Number(reservation.services.hourly_rate)
    : (menuTotal > 0 && totalAmount >= menuTotal ? totalAmount - menuTotal : totalAmount);
  const rawSum = serviceAmount + menuTotal;
  const discountAmount = Math.max(0, rawSum - totalAmount);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between text-gray-800">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 sm:py-16">
        {loading ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#c9a84c]/30 shadow-xl text-center space-y-5 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center mx-auto text-[#c9a84c]">
              <Loader2 size={32} className="animate-spin text-[#c9a84c]" />
            </div>
            <div>
              <h2 className="font-playfair text-2xl font-bold text-gray-900">
                Verifying PayMongo Payment...
              </h2>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                Securely confirming your transaction with PayMongo gateway. Your reservation and official receipt are being generated.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-red-200 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto text-red-600">
              <AlertCircle size={36} />
            </div>
            <div className="space-y-2">
              <h2 className="font-playfair text-2xl font-bold text-gray-900">
                Verification Incomplete
              </h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto">{error}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/reserve"
                className="px-6 py-3 bg-[#3d0a14] hover:bg-[#5c1020] text-gold rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Return to Reservations
              </Link>
              <Link
                href="/profile"
                className="px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Check My Profile
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden border border-[#c9a84c]/30 shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] p-8 sm:p-10 text-center text-white relative">
              <div className="w-20 h-20 rounded-full bg-[#c9a84c]/20 border-2 border-[#c9a84c] flex items-center justify-center text-[#c9a84c] mx-auto mb-4 shadow-lg shadow-black/30">
                <CheckCircle2 size={44} />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                <ShieldCheck size={13} />
                <span>PayMongo Payment Verified</span>
              </div>
              <h1 className="font-playfair text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
                Reservation Confirmed!
              </h1>
              <p className="text-xs sm:text-sm text-[#e5d3a1] max-w-md mx-auto leading-relaxed">
                Thank you, <strong className="text-white">{customerName}</strong>! Your payment was processed smoothly via PayMongo and your table is secured.
              </p>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Reservation Code Card */}
              <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-800">
                    Official Reservation Code
                  </span>
                  <div className="font-mono text-2xl font-black text-[#8b1327] tracking-wider mt-0.5">
                    {resCode}
                  </div>
                </div>
                <div className="text-right sm:text-right text-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 block">
                    Gateway Ref
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-700 bg-white px-2.5 py-1 rounded border border-gray-200 inline-block mt-0.5">
                    {paymentRef}
                  </span>
                </div>
              </div>

              {/* Booking Details Grid */}
              <div className="bg-[#faf9f6] border border-[#ece6dc] rounded-2xl p-5 text-sm space-y-3">
                <div className="flex justify-between items-center text-gray-600 pb-2.5 border-b border-gray-200/70">
                  <span className="font-medium flex items-center gap-2">
                    <Sparkles size={14} className="text-[#8b1327]" /> Service / Experience
                  </span>
                  <span className="font-bold text-gray-900">{serviceName}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 pb-2.5 border-b border-gray-200/70">
                  <span className="font-medium flex items-center gap-2">
                    <CalendarDays size={14} className="text-[#8b1327]" /> Date
                  </span>
                  <span className="font-bold text-gray-900">{bookingDate}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 pb-2.5 border-b border-gray-200/70">
                  <span className="font-medium flex items-center gap-2">
                    <Clock size={14} className="text-[#8b1327]" /> Time
                  </span>
                  <span className="font-bold text-gray-900">{bookingTime}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 pb-2.5 border-b border-gray-200/70">
                  <span className="font-medium flex items-center gap-2">
                    <Users size={14} className="text-[#8b1327]" /> Party Size
                  </span>
                  <span className="font-bold text-gray-900">{guests} Guests</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 pb-2.5 border-b border-gray-200/70">
                  <span className="font-medium flex items-center gap-2">
                    <CreditCard size={14} className="text-[#8b1327]" /> Payment Gateway
                  </span>
                  <span className="font-bold text-emerald-700">PayMongo ({paymentMethodLabel})</span>
                </div>

                {/* Service Fee Row */}
                <div className="flex justify-between items-center text-gray-600 pb-2.5 border-b border-gray-200/70">
                  <span className="font-medium">Service Fee</span>
                  <span className="font-bold text-gray-900">₱{serviceAmount.toLocaleString()}</span>
                </div>

                {/* Pre-ordered Menu Items */}
                {menuItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pre-ordered Items</p>
                    <div className="bg-white/70 border border-amber-100 rounded-xl p-3 space-y-1.5">
                      {menuItems.map((rm: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">
                            {rm.quantity > 1 && <span className="text-amber-600 font-bold mr-1.5">×{rm.quantity}</span>}
                            {rm.menu_items?.name}
                          </span>
                          <span className="font-semibold text-gray-800">₱{((rm.menu_items?.price ?? 0) * rm.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Menu Subtotal</span>
                      <span className="font-semibold text-gray-800">₱{menuTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <span className="font-semibold">Bundle / Promo Savings</span>
                    <span className="font-bold">-₱{discountAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-300">
                  <span className="font-bold text-gray-800 text-sm">Total Paid</span>
                  <span className="font-black text-[#8b1327] text-lg">
                    ₱{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Email Sent Notice Card */}
              {customerEmail && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#3d0a14] text-[#c9a84c] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Mail size={18} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#3d0a14] uppercase tracking-wider">
                      Booking Summary &amp; Official Receipt Dispatched
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      A complete confirmation receipt has been sent to{" "}
                      <strong className="text-gray-900">{customerEmail}</strong>. You can print it directly or review reservation status anytime.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {reservationId && (
                  <Link
                    href={`/receipt/${reservationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#c9a84c] hover:bg-[#b8953d] text-[#3d0a14] py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Printer size={16} />
                    <span>View &amp; Print Official Receipt</span>
                  </Link>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/profile"
                    className="w-full bg-[#3d0a14] hover:bg-[#5c1020] text-gold py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <User size={15} />
                    <span>View in My Profile</span>
                  </Link>
                  <Link
                    href="/"
                    className="w-full border-2 border-gray-200 hover:border-[#3d0a14] text-gray-700 hover:text-[#3d0a14] py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <Home size={15} />
                    <span>Return to Home</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#c9a84c]" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
