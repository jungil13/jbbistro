"use client";
import { useEffect, useState } from "react";
import { Sparkles, Clock, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function PromoSection() {
  const [promoData, setPromoData] = useState({
    enabled: true,
    badge: "Exclusive Promo",
    title: "Weekend VIP Karaoke & Pulutan Fiesta",
    description:
      "Book any VIP Karaoke Suite or Dining Table this Friday through Sunday and enjoy 20% off your booking, plus a complimentary signature Pulutan Platter and drinks on the house!",
    validity: "Every Fri - Sun • 5:00 PM to Midnight",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
  });
  const supabase = createClient();

  const loadPromoSettings = async () => {
    try {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "promo_enabled",
          "promo_badge",
          "promo_title",
          "promo_description",
          "promo_validity",
          "promo_image",
        ]);

      if (data && data.length > 0) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        setPromoData((prev) => ({
          enabled: map.promo_enabled !== "false",
          badge: map.promo_badge || prev.badge,
          title: map.promo_title || prev.title,
          description: map.promo_description || prev.description,
          validity: map.promo_validity || prev.validity,
          image: map.promo_image || prev.image,
        }));
      }
    } catch (e) {
      // Keep existing
    }
  };

  useEffect(() => {
    loadPromoSettings();

    // 1. Supabase Realtime Subscription for instant updates
    const channel = supabase
      .channel("realtime-promo-section")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload: any) => {
          if (payload.new && payload.new.key && payload.new.key.startsWith("promo_")) {
            loadPromoSettings();
          }
        }
      )
      .subscribe();

    // 2. High-frequency sync interval (every 3 seconds) for instant reflection across windows
    const interval = setInterval(() => {
      loadPromoSettings();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (!promoData.enabled) return null;

  return (
    <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#c9a84c]/30 bg-gradient-to-r from-[#2c070f] via-[#4d0c1b] to-[#1e050b]">
        {/* Decorative ambient backdrop */}
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay bg-cover bg-center"
          style={{ backgroundImage: `url('${promoData.image}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2c070f]/95 via-[#4d0c1b]/90 to-[#1e050b]/95" />

        {/* Content (Button removed as requested, full elegance display) */}
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 text-[#c9a84c] text-xs font-bold tracking-wider uppercase shadow-sm animate-pulse">
            <Sparkles size={13} />
            <span>{promoData.badge}</span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {promoData.title}
          </h2>

          <p className="text-white/85 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mx-auto">
            {promoData.description}
          </p>

          {promoData.validity && (
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-[#c9a84c] text-xs font-semibold">
              <Clock size={14} />
              <span>{promoData.validity}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
