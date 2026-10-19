"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Tag,
  Sparkles,
  Clock,
  Calendar,
  Flame,
  Cake,
  Package,
  Percent,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Info,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import {
  Promotion,
  PromotionType,
  getPromotionsAction
} from "@/app/actions/promotions";
import { getManilaDateTime } from "@/lib/dateUtils";
import { createClient } from "@/lib/supabase/client";

export default function CustomerPromotionsPage() {
  const supabase = createClient();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [user, setUser] = useState<any>(null);
  const [userDob, setUserDob] = useState<string | null>(null);

  const [manilaClock, setManilaClock] = useState({
    currentTimeStr: "12:00",
    currentDateStr: "",
    dayName: "",
    isHappyHourNow: false,
  });

  const loadData = async () => {
    try {
      const promos = await getPromotionsAction(false); // active only
      setPromotions(promos);

      const { currentTimeStr, currentDateStr, dayOfWeek } = getManilaDateTime();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      // Check if any happy hour is active right now
      const hhActive = promos.some(
        (p) =>
          p.type === "happy_hour" &&
          p.applicable_days.includes(dayOfWeek) &&
          p.start_time &&
          p.end_time &&
          currentTimeStr >= p.start_time &&
          currentTimeStr <= p.end_time
      );

      setManilaClock({
        currentTimeStr,
        currentDateStr,
        dayName: dayNames[dayOfWeek],
        isHappyHourNow: hhActive,
      });

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        const { data: profile } = await supabase
          .from("profiles")
          .select("dob")
          .eq("id", authUser.id)
          .single();
        if (profile?.dob) {
          setUserDob(profile.dob);
        }
      }
    } catch (e) {
      console.error("Error loading customer promotions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredPromotions = promotions.filter((p) => {
    if (filter === "all") return true;
    return p.type === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900">
      <Navbar />

      {/* Hero Banner */}
      <section
        className="relative pt-[68px] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.96)] via-[rgba(92,16,32,0.88)] to-[rgba(30,5,10,0.98)]" />
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
          <p
            className="text-[0.78rem] tracking-[0.25em] uppercase font-bold mb-3 flex items-center justify-center gap-2"
            style={{ color: "#c9a84c" }}
          >
            <Sparkles size={14} /> Exclusive Restobar Offers <Sparkles size={14} />
          </p>
          <h1
            className="text-[clamp(2.4rem,5vw,3.8rem)] font-bold text-white leading-[1.15] mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Promotions & Specials
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Elevate your dining and karaoke experience with limited-time percentage discounts, barkada meal
            bundles, sunset happy hours, and birthday rewards.
          </p>

          {/* Live Manila Happy Hour Ticker */}
          <div className="mt-8 inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-md border border-[#c9a84c]/30 text-white text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                manilaClock.isHappyHourNow ? "bg-rose-500 animate-ping" : "bg-[#c9a84c]"
              }`}
            />
            <span>
              {manilaClock.isHappyHourNow
                ? `🔥 Happy Hour is LIVE NOW in the Philippines (3:00 PM – 6:00 PM)!`
                : `Philippine Standard Time: ${manilaClock.currentTimeStr} (${manilaClock.dayName}) • Happy Hour starts at 3:00 PM`}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full space-y-8">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[
            { id: "all", label: "All Offers" },
            { id: "bundle", label: "🍱 Barkada Bundles" },
            { id: "happy_hour", label: "🍸 Happy Hour" },
            { id: "percentage", label: "🏷️ Percentage Deals" },
            { id: "fixed_amount", label: "💳 Fixed Vouchers" },
            { id: "birthday", label: "🎂 Birthday Special" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
                filter === cat.id
                  ? "bg-[#3d0a14] text-[#c9a84c] border border-[#c9a84c]"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Promotions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 bg-gray-200/60 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Tag size={32} className="text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">No active offers in this category</h3>
            <p className="text-xs text-gray-400 mt-1">
              Please check back soon or browse all available promotions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPromotions.map((promo) => {
              const isBundle = promo.type === "bundle";
              const isHappyHour = promo.type === "happy_hour";
              const isBirthday = promo.type === "birthday";

              return (
                <div
                  key={promo.id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                >
                  {/* Top Image */}
                  <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
                    {promo.image_url ? (
                      <img
                        src={promo.image_url}
                        alt={promo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#3d0a14] to-[#6b1020] flex items-center justify-center text-white/30">
                        <Tag size={40} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md bg-white/95 text-[#3d0a14] border border-[#c9a84c]">
                        {promo.type === "percentage"
                          ? `${promo.discount_percent}% Off`
                          : promo.type === "fixed_amount"
                          ? `₱${promo.discount_amount} Off`
                          : promo.type === "bundle"
                          ? "Bundle Deal"
                          : promo.type === "happy_hour"
                          ? "Happy Hour"
                          : "Birthday Treat"}
                      </span>
                    </div>

                    {/* Schedule / Validity */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3
                        className="font-bold text-lg leading-snug drop-shadow-sm text-white"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {promo.name}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {promo.description}
                      </p>

                      {/* Bundle Items Breakdown */}
                      {isBundle && promo.bundle_items && promo.bundle_items.length > 0 && (
                        <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-2xl space-y-2">
                          <p className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
                            What's Included:
                          </p>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {promo.bundle_items.map((it, idx) => (
                              <li key={idx} className="flex items-center justify-between text-[11px]">
                                <span>
                                  • {it.quantity}x {it.name}
                                </span>
                                <span className="text-gray-400">₱{(it.original_price * it.quantity).toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between font-bold text-xs">
                            <span className="text-amber-950 font-black text-sm">
                              Promo Price: ₱{promo.bundle_price.toLocaleString()}
                            </span>
                            <span className="text-emerald-700 font-extrabold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                              Save ₱{promo.discount_amount || 130}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Happy Hour Details */}
                      {isHappyHour && (
                        <div className="mt-4 p-3 bg-rose-50 border border-rose-200/70 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-rose-900">
                            <Clock size={14} />
                            <span>
                              {promo.start_time} - {promo.end_time} (Asia/Manila)
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Applies to beverages & pulutan Monday through Friday.
                          </p>
                        </div>
                      )}

                      {/* Birthday Treat Details */}
                      {isBirthday && (
                        <div className="mt-4 p-3 bg-pink-50 border border-pink-200/70 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-pink-900">
                            <Cake size={14} />
                            <span>{promo.birthday_reward_name || "Complimentary Sweet Treat"}</span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Redeemable once per calendar year with verified birth date.
                          </p>
                        </div>
                      )}

                      {/* Terms snippet */}
                      {promo.terms && (
                        <p className="mt-3 text-[10px] text-gray-400 flex items-center gap-1">
                          <Info size={11} className="flex-shrink-0" />
                          <span className="line-clamp-1">{promo.terms}</span>
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-gray-400">
                        {promo.min_spend > 0 ? `Min. spend ₱${promo.min_spend.toLocaleString()}` : "No min. spend"}
                      </div>
                      <Link
                        href={`/reserve?promo_id=${promo.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3d0a14] hover:bg-[#5c1020] text-[#c9a84c] text-xs font-bold transition-all shadow-sm active:scale-95"
                      >
                        <span>{isBundle ? "Order Bundle" : "Apply in Reservation"}</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
