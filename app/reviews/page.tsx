"use client";

import { useEffect, useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  Star,
  Sparkles,
  CheckCircle2,
  Quote,
  PenLine,
  Search,
  Filter,
  ShieldCheck,
  HeartHandshake,
  Clock,
  ArrowRight,
  MessageSquareHeart,
  ChevronDown,
  CalendarDays,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { CustomerRating } from "@/lib/ratings";
import { submitRatingAction, getRatingsAction } from "@/app/actions/ratings";
import toast, { Toaster } from "react-hot-toast";

const SERVICE_OPTIONS = [
  "All Services",
  "VIP Karaoke Suite",
  "Billiards Lounge",
  "Pulutan & Cocktails",
  "Private Event & Celebrations",
  "Overall Dining Experience",
  "Fine Dining & Wine",
];

const FORM_SERVICE_OPTIONS = [
  "VIP Karaoke Suite",
  "Billiards Lounge",
  "Pulutan & Cocktails",
  "Private Event & Celebrations",
  "Overall Dining Experience",
  "Fine Dining & Wine",
];

const RATING_LABELS: Record<number, string> = {
  1: "Could be better (1/5)",
  2: "Fair experience (2/5)",
  3: "Good dining & service (3/5)",
  4: "Great experience! (4/5)",
  5: "Exceptional! 5 Stars",
};

export default function ReviewsPage() {
  const supabase = createClient();
  const formRef = useRef<HTMLDivElement>(null);

  const [ratings, setRatings] = useState<CustomerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState("All Services");
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | "all">("all");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [serviceType, setServiceType] = useState(FORM_SERVICE_OPTIONS[0]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState(false);

  // Authenticated state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [userReservations, setUserReservations] = useState<any[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string>("");

  const loadApprovedRatings = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_ratings")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRatings(data as CustomerRating[]);
      } else {
        const fallbackRes = await getRatingsAction();
        if (fallbackRes.success) setRatings(fallbackRes.data);
      }
    } catch (err) {
      console.error("Error loading reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovedRatings();

    // Check auth status for review form prefill
    const initAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();

          const fullName =
            `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
            user.email?.split("@")[0] ||
            "";
          setCurrentUser({ id: user.id, email: user.email || "", name: fullName });
          if (fullName) setName(fullName);

          const { data: reservations } = await supabase
            .from("reservations")
            .select("id, date, status, services(name)")
            .eq("customer_email", user.email)
            .order("date", { ascending: false });

          if (reservations && reservations.length > 0) {
            setUserReservations(reservations);
            setSelectedReservationId(reservations[0].id);
            const sName = (reservations[0].services as any)?.name;
            if (sName) setServiceType(sName);
          }
        }
      } catch (e) {
        console.error("Error checking auth for reviews:", e);
      }
    };
    initAuth();

    // Supabase Real-time listener for approvals and new reviews
    const channel = supabase
      .channel("reviews-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_ratings" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const item = payload.new as CustomerRating;
            if (item.status === "approved") {
              setRatings((prev) => {
                const exists = prev.some((r) => r.id === item.id);
                if (exists) {
                  return prev.map((r) => (r.id === item.id ? item : r));
                }
                return [item, ...prev];
              });
            } else {
              setRatings((prev) => prev.filter((r) => r.id !== item.id));
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
      toast.error("Please enter your name and review feedback.");
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
      setSubmittedNotice(true);
      toast.success(
        "Thank you for your review! We are glad to serve you. Your review will be displayed once approved by our team.",
        {
          duration: 6500,
        }
      );
      setComment("");
      setRating(5);
    } else {
      toast.error(res.error || "Failed to submit review. Please try again.");
    }
  };

  const scrollToForm = () => {
    setIsFormOpen(true);
    setSubmittedNotice(false);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Calculations for summary statistics
  const totalApproved = ratings.length;
  const avgRating =
    totalApproved > 0
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / totalApproved).toFixed(1)
      : "5.0";

  const ratingCounts = {
    5: ratings.filter((r) => r.rating === 5).length,
    4: ratings.filter((r) => r.rating === 4).length,
    3: ratings.filter((r) => r.rating === 3).length,
    2: ratings.filter((r) => r.rating === 2).length,
    1: ratings.filter((r) => r.rating === 1).length,
  };

  // Filtered reviews
  const displayedReviews = ratings.filter((r) => {
    if (selectedService !== "All Services" && r.service_type !== selectedService) {
      return false;
    }
    if (selectedRatingFilter !== "all" && r.rating !== selectedRatingFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.name?.toLowerCase().includes(q);
      const matchComment = r.comment?.toLowerCase().includes(q);
      const matchService = r.service_type?.toLowerCase().includes(q);
      if (!matchName && !matchComment && !matchService) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between">
      <Navbar />
      <Toaster position="top-center" />

      <main className="flex-1">
        {/* ── Hero Banner ── */}
        <div
          className="relative pt-[68px] overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.95)] via-[rgba(107,16,32,0.90)] to-[rgba(30,5,10,0.96)]" />
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 text-[#c9a84c] text-xs font-bold tracking-wider uppercase mb-4 shadow-sm">
              <Sparkles size={13} className="text-[#c9a84c]" />
              <span>Customer Reviews &amp; Stories</span>
            </div>

            {/* Title */}
            <h1
              className="font-playfair text-[clamp(2.2rem,5vw,3.6rem)] font-bold text-white leading-[1.15] mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Loved by Our Guests
            </h1>

            {/* Subtitle */}
            <p className="text-white/85 text-sm sm:text-base max-w-[580px] mx-auto leading-relaxed mb-7 font-normal">
              Authentic dining, karaoke celebrations, and leisure experiences shared by our valued guests. Every review helps us serve you better.
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={scrollToForm}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#800A1D] via-[#A30D25] to-[#c9a84c] hover:brightness-110 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
              >
                <PenLine size={15} />
                <span>Write a Review</span>
              </button>

              <Link
                href="/reserve"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white/90 bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md transition-all active:scale-95"
              >
                <UtensilsCrossed size={15} className="text-[#c9a84c]" />
                <span>Book a Table or VIP Suite</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Main Content Container ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {/* ── Ratings Overview Summary Card ── */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-[#c9a84c]/20 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* Overall Score */}
              <div className="md:col-span-4 text-center md:text-left md:border-r border-gray-100 md:pr-8">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B6E28]">
                  Overall Guest Rating
                </span>
                <div className="flex items-baseline justify-center md:justify-start gap-2 mt-2">
                  <span className="font-playfair text-5xl sm:text-6xl font-extrabold text-[#3d0a14]">
                    {avgRating}
                  </span>
                  <span className="text-gray-400 font-bold text-lg">/ 5.0</span>
                </div>

                <div className="flex items-center justify-center md:justify-start gap-1 my-2 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className={
                        i < Math.round(Number(avgRating))
                          ? "fill-amber-400 text-amber-400 filter drop-shadow-2xs"
                          : "text-gray-200 fill-gray-100"
                      }
                    />
                  ))}
                </div>

                <p className="text-xs text-gray-500 font-medium">
                  Based on <strong className="text-gray-800">{totalApproved}</strong> approved customer review{totalApproved !== 1 ? "s" : ""}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center md:justify-start gap-2 text-[11px] text-emerald-700 font-semibold bg-emerald-50/60 rounded-xl px-3 py-2 border border-emerald-200/50">
                  <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                  <span>Admin Moderated &amp; Verified Reviews</span>
                </div>
              </div>

              {/* Star Rating Breakdown Bars */}
              <div className="md:col-span-5 space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingCounts[stars as keyof typeof ratingCounts] || 0;
                  const percent = totalApproved > 0 ? Math.round((count / totalApproved) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-3 text-xs">
                      <button
                        onClick={() =>
                          setSelectedRatingFilter(selectedRatingFilter === stars ? "all" : stars)
                        }
                        className={`flex items-center gap-1 font-semibold w-14 hover:text-[#8B6E28] transition-colors ${
                          selectedRatingFilter === stars ? "text-[#8B6E28] font-bold" : "text-gray-600"
                        }`}
                      >
                        <span>{stars}</span>
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                      </button>

                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-[#c9a84c] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <span className="w-10 text-right text-gray-400 font-medium text-[11px]">
                        {count} ({percent}%)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Call to Write Review CTA */}
              <div className="md:col-span-3 text-center md:text-right flex flex-col items-center md:items-end justify-center bg-gradient-to-br from-[#faf7f2] to-[#f4eee4] p-5 rounded-2xl border border-[#c9a84c]/20">
                <span className="text-xs font-bold text-[#3d0a14] mb-1">Dined with Us Recently?</span>
                <p className="text-[11px] text-gray-600 mb-3.5 max-w-[200px]">
                  Help other food lovers find the best dishes and karaoke suites in Liloan.
                </p>
                <button
                  onClick={scrollToForm}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B0612] to-[#800A1D] hover:from-[#720817] hover:to-[#9c0d23] shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                >
                  <PenLine size={13} />
                  <span>Share Your Experience</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Review Submission Form Section ── */}
          <div ref={formRef} className="mb-12">
            {!isFormOpen ? (
              <div className="text-center py-6">
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-[#c9a84c]/40 text-[#3d0a14] font-bold text-sm hover:bg-[#faf7f2] hover:border-[#c9a84c] shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <PenLine size={16} className="text-[#c9a84c]" />
                  <span>Click Here to Write a Review</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_12px_45px_rgba(61,10,20,0.06)] border-2 border-[#c9a84c]/30 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5B0612] to-[#800A1D] text-white flex items-center justify-center shadow-xs">
                      <MessageSquareHeart size={20} className="text-[#c9a84c]" />
                    </div>
                    <div>
                      <h3 className="font-playfair text-lg sm:text-xl font-bold text-[#3d0a14]">
                        Write a Customer Review
                      </h3>
                      <p className="text-xs text-gray-500">
                        Share your authentic feedback with the Jbenz Bistro team &amp; community
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsFormOpen(false);
                      setSubmittedNotice(false);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Close Form
                  </button>
                </div>

                {submittedNotice ? (
                  /* Thank You Notice Box (Explicitly requested by user) */
                  <div className="py-8 px-6 text-center max-w-lg mx-auto bg-gradient-to-b from-[#faf7f2] to-white rounded-3xl border border-[#c9a84c]/30 shadow-sm animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border-2 border-emerald-300 shadow-sm">
                      <HeartHandshake size={32} />
                    </div>
                    <h4 className="font-playfair text-2xl font-bold text-[#3d0a14] mb-2">
                      Thank you for your review!
                    </h4>
                    <p className="text-base font-semibold text-[#8B6E28] mb-3">
                      We are glad to serve you.
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-6">
                      Your feedback has been submitted successfully! To protect community integrity, customer reviews are displayed on this page once verified and approved by our management team.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          setSubmittedNotice(false);
                          setIsFormOpen(false);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5B0612] to-[#800A1D] text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
                      >
                        Done &amp; Close Form
                      </button>
                      <button
                        onClick={() => {
                          setSubmittedNotice(false);
                          setComment("");
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Submit Another Review
                      </button>
                    </div>
                  </div>
                ) : (
                  /* The Review Submission Form */
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Admin Approval Notice Banner */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                      <Clock size={16} className="text-amber-800 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-900 leading-relaxed">
                        <strong className="font-bold">Moderation Notice:</strong> After submission, reviews are reviewed by our administration before being published live on the reviews page.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Overall Star Rating Selector */}
                      <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#c9a84c]/20 text-center">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                          Your Overall Rating *
                        </label>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="p-1 hover:scale-120 transition-transform cursor-pointer"
                              aria-label={`${star} Stars`}
                            >
                              <Star
                                size={28}
                                className={
                                  (hoverRating || rating) >= star
                                    ? "fill-amber-400 text-amber-400 filter drop-shadow-xs"
                                    : "text-gray-300 fill-gray-100"
                                }
                              />
                            </button>
                          ))}
                        </div>
                        <span className="text-xs font-bold text-[#8B6E28]">
                          {RATING_LABELS[hoverRating || rating]}
                        </span>
                      </div>

                      {/* Service / Experience Selection */}
                      <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#c9a84c]/20">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                          Service or Area Reviewed *
                        </label>
                        <select
                          value={serviceType}
                          onChange={(e) => setServiceType(e.target.value)}
                          className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all text-gray-800"
                        >
                          {FORM_SERVICE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-gray-400 mt-2">
                          Select the primary service you experienced at Jbenz Bistro
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Reviewer Name */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Your Name *
                          </label>
                          {currentUser ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={10} className="text-emerald-600" />
                              Auto-filled Account
                            </span>
                          ) : (
                            <Link
                              href="/login?redirect=/reviews"
                              className="text-[11px] text-[#8B6E28] hover:underline"
                            >
                              Sign In to verify account
                            </Link>
                          )}
                        </div>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Maria Santos"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all text-gray-800 font-medium bg-white"
                        />
                      </div>

                      {/* Optional reservation link if customer is logged in */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Dining Visit (Optional)
                        </label>
                        {currentUser && userReservations.length > 0 ? (
                          <select
                            value={selectedReservationId}
                            onChange={(e) => {
                              setSelectedReservationId(e.target.value);
                              const match = userReservations.find((r) => r.id === e.target.value);
                              if (match?.services?.name) setServiceType(match.services.name);
                            }}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white text-gray-800"
                          >
                            <option value="">General dining visit</option>
                            {userReservations.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.services?.name || "Reservation"} — {new Date(r.date).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            disabled
                            value="General Bistro Dining / Walk-In Visit"
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed select-none"
                          />
                        )}
                      </div>
                    </div>

                    {/* Review Feedback Comment */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Your Feedback &amp; Dining Story *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your dining experience! How was the food presentation, sound system in the karaoke suite, billiard table slate, or the staff's hospitality?"
                        className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-gray-200 focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all resize-none text-gray-800 leading-relaxed bg-white"
                      />
                    </div>

                    {/* Submit Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
                      <p className="text-[11px] text-gray-500">
                        We appreciate your honest rating and review!
                      </p>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsFormOpen(false)}
                          className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-1/2 sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B0612] to-[#800A1D] hover:from-[#720817] hover:to-[#9c0d23] shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting ? "Submitting…" : "Publish Review"}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* ── Filters & Search Bar ── */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
            {/* Service & Star Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
                <Filter size={13} /> Filter:
              </span>
              {SERVICE_OPTIONS.slice(0, 5).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedService(opt)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                    selectedService === opt
                      ? "bg-[#3d0a14] text-white shadow-xs font-bold"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {opt}
                </button>
              ))}
              {selectedRatingFilter !== "all" && (
                <button
                  onClick={() => setSelectedRatingFilter("all")}
                  className="text-xs px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300 flex items-center gap-1"
                >
                  <span>{selectedRatingFilter} Stars</span>
                  <span className="text-amber-700">✕</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviews or dishes…"
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-full focus:outline-none focus:border-[#c9a84c] text-gray-800 shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* ── Reviews Grid ── */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-56 bg-gray-200/60 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : displayedReviews.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-[#c9a84c]/20 shadow-sm p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-[#8B6E28] flex items-center justify-center mx-auto mb-3">
                <Sparkles size={24} />
              </div>
              <h3 className="font-playfair text-lg font-bold text-gray-900 mb-1">
                No matching reviews found
              </h3>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                {search || selectedService !== "All Services" || selectedRatingFilter !== "all"
                  ? "Try resetting your search query or filters to see all customer reviews."
                  : "Be the first customer to share your dining experience at Jbenz Bistro!"}
              </p>
              {(search || selectedService !== "All Services" || selectedRatingFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedService("All Services");
                    setSelectedRatingFilter("all");
                  }}
                  className="px-4 py-2 rounded-full text-xs font-bold text-[#3d0a14] bg-[#faf7f2] border border-[#c9a84c]/30 hover:bg-[#c9a84c]/20 transition-all cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedReviews.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#c9a84c]/20 hover:border-[#c9a84c]/60 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
                >
                  <div>
                    {/* Top Star Rating & Category Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={
                              i < item.rating
                                ? "fill-amber-400 text-amber-400 filter drop-shadow-2xs"
                                : "text-gray-200 fill-gray-100"
                            }
                          />
                        ))}
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B6E28] bg-[#fbf5e6] px-2.5 py-1 rounded-full border border-[#c9a84c]/20 truncate max-w-[150px]">
                        {item.service_type || "Bistro Dining"}
                      </span>
                    </div>

                    {/* Review Comment */}
                    <div className="relative mb-4">
                      <Quote
                        size={22}
                        className="text-[#c9a84c]/25 absolute -top-1 -left-1 pointer-events-none -scale-x-100"
                      />
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed italic pl-4 font-serif">
                        "{item.comment}"
                      </p>
                    </div>
                  </div>

                  {/* Reviewer Profile Footer */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B0612] to-[#8B6E28] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {item.name ? item.name.charAt(0).toUpperCase() : "G"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 leading-tight">
                          {item.name || "Customer"}
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
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Bottom Call-To-Action Banner ── */}
          <div className="mt-16 bg-gradient-to-r from-[#3d0a14] via-[#5B0612] to-[#3d0a14] rounded-3xl p-8 sm:p-10 text-white text-center relative overflow-hidden border border-[#c9a84c]/40 shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#c9a84c]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 max-w-xl mx-auto space-y-3">
              <span className="text-xs font-bold tracking-widest uppercase text-[#c9a84c]">
                Join Us Today
              </span>
              <h3 className="font-playfair text-2xl sm:text-3xl font-bold text-white">
                Ready to Experience Jbenz Bistro?
              </h3>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                Book a table in our dining hall, reserve a VIP karaoke suite for your party, or challenge your friends at our professional billiard tables.
              </p>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/reserve"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#800A1D] to-[#c9a84c] hover:brightness-110 shadow-md transition-all active:scale-95"
                >
                  Book a Reservation Now
                </Link>
                <Link
                  href="/menu"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 transition-all active:scale-95"
                >
                  Browse Our Menu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
