"use client";

import { useEffect, useState } from "react";
import {
  Star,
  Sparkles,
  CheckCircle2,
  Quote,
  PenLine,
  X,
  MessageSquareHeart,
  ChevronRight,
  Clock,
  Lock,
  AlertCircle,
  CalendarDays,
  ArrowRight,
  HeartHandshake,
} from "lucide-react";
import Link from "next/link";
import { CustomerRating, FALLBACK_RATINGS } from "@/lib/ratings";
import { submitRatingAction } from "@/app/actions/ratings";
import { createClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";

const SERVICE_OPTIONS = [
  "VIP Karaoke Suite",
  "Billiards Lounge",
  "Pulutan & Cocktails",
  "Private Event & Celebrations",
  "Overall Dining Experience",
  "Fine Dining & Wine",
];

const RATING_LABELS: Record<number, string> = {
  1: "Could be better",
  2: "Fair experience",
  3: "Good dining & service",
  4: "Great experience!",
  5: "Exceptional! 5 Stars",
};

interface CustomerRatingsProps {
  initialRatings?: CustomerRating[];
}

export default function CustomerRatings({ initialRatings }: CustomerRatingsProps) {
  const [ratings, setRatings] = useState<CustomerRating[]>(
    initialRatings && initialRatings.length > 0 ? initialRatings : []
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [serviceType, setServiceType] = useState(SERVICE_OPTIONS[0]);
  const [comment, setComment] = useState("");

  // Authenticated Profile & Reservation State
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [userReservations, setUserReservations] = useState<any[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string>("");

  const supabase = createClient();

  // Computed stats from real data
  const approvedRatings = ratings.filter((r) => r.status === "approved" || !r.status);
  const totalCount = approvedRatings.length;
  const avgRating =
    totalCount > 0
      ? Math.round((approvedRatings.reduce((sum, r) => sum + r.rating, 0) / totalCount) * 10) / 10
      : 0;
  const fiveStarCount = approvedRatings.filter((r) => r.rating === 5).length;

  const checkUserAndReservations = async () => {
    setCheckingAuth(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser(null);
        setCheckingAuth(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || user.email?.split("@")[0] || "";
      setCurrentUser({ id: user.id, email: user.email || "", name: fullName });
      if (fullName) {
        setName(fullName);
      }

      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, date, status, services(name)")
        .eq("customer_email", user.email)
        .order("date", { ascending: false });

      const allRes = reservations || [];
      setUserReservations(allRes);

      if (allRes.length > 0) {
        setSelectedReservationId(allRes[0].id);
        const sName = (allRes[0].services as any)?.name;
        if (sName) setServiceType(sName);
      }
    } catch (err) {
      console.error("Error loading user or reservations for review:", err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleOpenReviewModal = () => {
    setSubmittedSuccess(false);
    setIsModalOpen(true);
    checkUserAndReservations();
  };

  useEffect(() => {
    setLoadingRatings(true);
    supabase
      .from("customer_ratings")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) {
          setRatings(data as CustomerRating[]);
        }
        setLoadingRatings(false);
      });

    const channel = supabase
      .channel("realtime-customer-ratings-home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_ratings" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const updated = payload.new as CustomerRating;
            if (updated.status === "approved") {
              setRatings((prev) => {
                const withoutSeeds = prev.filter((r) => !r.id.startsWith("seed-"));
                const exists = withoutSeeds.some((r) => r.id === updated.id);
                if (exists) {
                  return withoutSeeds.map((r) => (r.id === updated.id ? updated : r));
                }
                return [updated, ...withoutSeeds];
              });
            } else {
              setRatings((prev) => prev.filter((r) => r.id !== updated.id));
            }
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setRatings((prev) => prev.filter((r) => r.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) {
      toast.error("Please fill in your name and review comment.");
      return;
    }

    setSubmitting(true);
    const res = await submitRatingAction({
      name,
      rating,
      comment,
      service_type: serviceType,
      user_id: currentUser?.id,
      reservation_id: selectedReservationId || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      toast.success(
        "Thank you for your review! We are glad to serve you. Your review will be displayed once approved by our team.",
        {
          duration: 6000,
        }
      );
      setSubmittedSuccess(true);
      setComment("");
      setRating(5);
    } else {
      toast.error(res.error || "Failed to submit rating. Please try again.");
    }
  };

  const displayItems =
    ratings.length === 0
      ? []
      : ratings.length === 1
      ? [ratings[0], ratings[0], ratings[0], ratings[0]]
      : [...ratings, ...ratings];

  return (
    <section className="relative py-16 sm:py-20 bg-gradient-to-b from-white via-[#faf7f2] to-white overflow-hidden border-t border-b border-[#c9a84c]/15">
      <Toaster position="top-center" />

      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-red-100/40 via-amber-100/50 to-red-100/40 blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/30 text-[#8B6E28] text-xs font-bold tracking-widest uppercase mb-3.5 shadow-2xs">
          <Sparkles size={13} className="text-[#c9a84c]" />
          <span>Guest Ratings & Stories</span>
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#3d0a14] font-playfair tracking-tight">
          Loved by Customers
        </h2>
        <p className="text-sm text-gray-500 max-w-lg mx-auto mt-2">
          Discover genuine dining and celebration reviews from our verified guests.
        </p>

        {/* Stats Row */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
          {!loadingRatings && totalCount > 0 && (
            <div className="flex items-center gap-1.5 font-bold text-gray-900 bg-white/90 border border-gray-200/80 px-3.5 py-1.5 rounded-full shadow-2xs">
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={15}
                    className={
                      i < Math.round(avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-gray-200 text-gray-200"
                    }
                  />
                ))}
              </div>
              <span className="text-[#3d0a14] font-extrabold ml-1">{avgRating.toFixed(1)} / 5.0</span>
            </div>
          )}

          {!loadingRatings && totalCount > 0 && (
            <>
              <span className="hidden sm:inline text-gray-300">•</span>
              <span className="font-medium text-gray-600 bg-amber-50/60 border border-amber-200/50 px-3 py-1.5 rounded-full">
                {fiveStarCount > 0
                  ? `${fiveStarCount} Five-Star Review${fiveStarCount !== 1 ? "s" : ""} · ${totalCount} Approved`
                  : `${totalCount} Approved Review${totalCount !== 1 ? "s" : ""}`}
              </span>
            </>
          )}

          {loadingRatings && (
            <span className="font-medium text-gray-400 animate-pulse">Loading reviews…</span>
          )}

          <button
            onClick={handleOpenReviewModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#5B0612] to-[#800A1D] hover:from-[#720817] hover:to-[#9c0d23] px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <PenLine size={13} />
            <span>Leave a Review</span>
          </button>

          <Link
            href="/reviews"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3d0a14] bg-white border border-[#c9a84c]/40 hover:bg-[#faf7f2] hover:border-[#c9a84c] px-4 py-2 rounded-full shadow-2xs transition-all active:scale-95"
          >
            <span>View All Reviews</span>
            <ArrowRight size={13} className="text-[#c9a84c]" />
          </Link>
        </div>
      </div>

      {/* ── Infinite Looping Marquee Carousel ── */}
      <div className="relative w-full overflow-hidden py-4">
        {/* Left & Right gradient edge fades */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

        {ratings.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-10 px-6 bg-white rounded-3xl border border-[#c9a84c]/20 shadow-sm my-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <Sparkles size={20} className="text-[#c9a84c]" />
            </div>
            <h3 className="font-playfair text-base font-bold text-gray-900 mb-1">Be Our First Reviewer</h3>
            <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
              Share your dining or karaoke experience with us and help fellow diners discover Jbenz Bistro.
            </p>
            <button
              onClick={handleOpenReviewModal}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#5B0612] hover:bg-[#800A1D] px-4 py-2 rounded-full transition-all shadow-sm cursor-pointer"
            >
              <PenLine size={13} />
              <span>Write a Review</span>
            </button>
          </div>
        ) : (
          <div className="animate-marquee flex gap-5 sm:gap-6 w-max pl-4">
            {displayItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="w-[310px] sm:w-[360px] flex-shrink-0 bg-white rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-[#c9a84c]/20 hover:border-[#c9a84c]/60 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
              >
                <div>
                  {/* Top: Stars & Category */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={15}
                          className={
                            i < item.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200 fill-gray-100"
                          }
                        />
                      ))}
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B6E28] bg-[#fbf5e6] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/20 truncate max-w-[150px]">
                      {item.service_type || "Bistro Dining"}
                    </span>
                  </div>

                  {/* Quote Text */}
                  <div className="relative">
                    <Quote
                      size={22}
                      className="text-[#c9a84c]/25 absolute -top-1 -left-1 pointer-events-none -scale-x-100"
                    />
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed italic line-clamp-4 pl-4 pt-1 font-serif">
                      "{item.comment}"
                    </p>
                  </div>
                </div>

                {/* Bottom Author Card */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B0612] to-[#8B6E28] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {item.name ? item.name.charAt(0).toUpperCase() : "G"}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">
                        {item.name || "Guest Diner"}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold mt-0.5">
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        <span>Verified Review</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Leave a Review Modal ── */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[390px] sm:max-w-md max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-[#c9a84c]/30 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#3d0a14] via-[#5B0612] to-[#3d0a14] text-white px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between border-b border-[#c9a84c]/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/10 border border-[#c9a84c]/40 flex items-center justify-center text-[#c9a84c]">
                  <MessageSquareHeart size={16} />
                </div>
                <div>
                  <h3 className="font-playfair text-sm sm:text-base font-bold text-white leading-tight">
                    Rate Your Experience
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#c9a84c] font-medium leading-tight">
                    Jbenz Bistro Guest Feedback
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content: Checking Auth vs Success vs Review Form */}
            {checkingAuth ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-9 h-9 border-2 border-red-900 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-500 font-medium">Preparing review form…</p>
              </div>
            ) : submittedSuccess ? (
              /* Success Notice Screen */
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-sm animate-in zoom-in-50 duration-300">
                  <HeartHandshake size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 font-playfair">
                    Thank you for your review!
                  </h4>
                  <p className="text-sm font-semibold text-[#8B6E28] mt-1">
                    We are glad to serve you.
                  </p>
                  <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-left">
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Your feedback has been submitted successfully. To maintain genuine community reviews, it will be displayed on the website once approved by our team.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-[#5B0612] to-[#800A1D] text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all text-center cursor-pointer"
                  >
                    Close & Continue Browsing
                  </button>
                  <Link
                    href="/reviews"
                    onClick={() => setIsModalOpen(false)}
                    className="text-xs font-semibold text-[#8B6E28] hover:text-[#5B0612] transition-colors"
                  >
                    Explore All Reviews →
                  </Link>
                </div>
              </div>
            ) : (
              /* Review Form */
              <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto no-scrollbar">
                {/* Admin Approval Notice Banner */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 flex items-start gap-2 text-left">
                  <Clock size={14} className="text-amber-700 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Submitted reviews are published on the website following admin approval.
                  </p>
                </div>

                {/* Star Rating Selector */}
                <div className="text-center py-2.5 px-2 bg-[#fdfbf7] rounded-xl border border-[#c9a84c]/25">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Overall Rating
                  </label>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 hover:scale-115 transition-transform cursor-pointer"
                      >
                        <Star
                          size={24}
                          className={
                            (hoverRating || rating) >= star
                              ? "fill-amber-400 text-amber-400 filter drop-shadow-xs"
                              : "text-gray-300 fill-gray-100"
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold text-[#8B6E28]">
                    {RATING_LABELS[hoverRating || rating]}
                  </p>
                </div>

                {/* Reviewer Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] sm:text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Your Name *
                    </label>
                    {currentUser ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={10} className="text-emerald-600" />
                        Verified Account
                      </span>
                    ) : (
                      <Link
                        href="/login?redirect=/"
                        className="text-[10px] text-[#8B6E28] hover:underline"
                      >
                        Sign In (Optional)
                      </Link>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name (e.g. Maria Santos)"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all text-gray-800 font-medium"
                  />
                </div>

                {/* Reservation link if authenticated */}
                {currentUser && userReservations.length > 0 && (
                  <div>
                    <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Link Reservation (Optional)
                    </label>
                    <select
                      value={selectedReservationId}
                      onChange={(e) => {
                        setSelectedReservationId(e.target.value);
                        const match = userReservations.find((r) => r.id === e.target.value);
                        if (match?.services?.name) setServiceType(match.services.name);
                      }}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white"
                    >
                      <option value="">No reservation selected</option>
                      {userReservations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.services?.name || "Dining"} — {new Date(r.date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Service Type */}
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Service / Experience
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white"
                  >
                    {SERVICE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Feedback Comment */}
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Your Review *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience with the food, ambiance, music, or hospitality…"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all resize-none text-gray-800"
                  />
                </div>

                {/* Submit Actions */}
                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#5B0612] to-[#800A1D] hover:from-[#720817] hover:to-[#9c0d23] shadow-xs hover:shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {submitting ? "Submitting…" : "Submit Review"}
                    <ChevronRight size={13} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
