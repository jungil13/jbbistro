"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, X, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AnnouncementBanner() {
  const [bannerText, setBannerText] = useState(
    "🎉 Special Promo: 20% Off All VIP Karaoke Suites this Weekend! Free Pulutan Platter with every booking."
  );
  const [isEnabled, setIsEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const supabase = createClient();
  const prevEnabled = useRef<boolean | null>(null);

  async function fetchBannerSettings() {
    try {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["promo_banner_enabled", "promo_banner_text"]);

      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        const enabled = map.promo_banner_enabled !== "false" && !!(map.promo_banner_text?.trim());

        // If it just turned ON (admin added text), reset dismissed so it re-shows
        if (enabled && prevEnabled.current === false) {
          setDismissed(false);
          setAnimateIn(false);
          setTimeout(() => setAnimateIn(true), 50);
        }

        prevEnabled.current = enabled;
        setIsEnabled(enabled);

        if (map.promo_banner_text) setBannerText(map.promo_banner_text);
      }
    } catch (e) {
      // Keep defaults
    }
  }

  useEffect(() => {
    fetchBannerSettings().then(() => {
      setTimeout(() => setAnimateIn(true), 400);
    });

    // Supabase Realtime for instant updates
    const channel = supabase
      .channel("announcement-toast-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload: any) => {
          if (
            payload.new &&
            payload.new.key &&
            payload.new.key.startsWith("promo_banner")
          ) {
            fetchBannerSettings();
          }
        }
      )
      .subscribe();

    // Polling fallback every 5s
    const interval = setInterval(fetchBannerSettings, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (!isEnabled || dismissed) return null;

  return (
    <div
      aria-label="Announcement"
      role="alert"
      className={`fixed top-20 right-4 z-[999] w-[320px] sm:w-[360px] transition-all duration-500 ease-out ${
        animateIn
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-16"
      }`}
    >
      <div className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-2xl shadow-2xl border border-[#c9a84c]/40 overflow-hidden">
        {/* Gold shimmer accent top line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss announcement"
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <X size={12} />
        </button>

        <div className="p-4 pr-8">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-2.5">
            {/* Pulsing gold icon */}
            <div className="relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a84c] opacity-60" />
              <div className="relative w-7 h-7 rounded-full bg-[#c9a84c] text-[#3d0a14] flex items-center justify-center shadow-md">
                <Megaphone size={13} />
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c9a84c]">
              Announcement
            </span>
          </div>

          {/* Message text */}
          <p className="text-[13px] text-white/90 leading-relaxed font-medium">
            {bannerText}
          </p>

          {/* CTA link */}
          <Link
            href="/announcements"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c9a84c] hover:text-white transition-colors group"
          >
            View Announcement
            <ArrowRight
              size={12}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        </div>

        {/* Bottom shimmer */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" />
      </div>
    </div>
  );
}

