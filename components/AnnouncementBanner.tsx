"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAnnouncements,
  dismissAnnouncementBannerAction,
  AnnouncementItem,
} from "@/app/actions/announcements";

export default function AnnouncementBanner() {
  const pathname = usePathname();
  const [bannerItem, setBannerItem] = useState<AnnouncementItem | null>(null);
  const [bannerText, setBannerText] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const supabase = createClient();
  const activeItemIdRef = useRef<string | null>(null);

  // Hide banner on admin, manager, or auth pages
  const isExcludedPage =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/manager") ||
    pathname?.startsWith("/login");

  const fetchBanner = useCallback(async () => {
    try {
      // 1. Check active announcement banner directly from the database
      const res = await getAnnouncements();
      if (res.success && Array.isArray(res.data)) {
        // Only show if active AND designated to show as banner toast in the database
        const item = res.data.find((i) => i.is_active && i.show_banner);

        if (item) {
          const text = item.description || item.title;
          setBannerItem(item);
          setBannerText(text);
          setIsEnabled(true);
          setDismissed(false);
          activeItemIdRef.current = item.id;
          setTimeout(() => setAnimateIn(true), 100);
          return;
        } else {
          // Admin deactivated announcement or banner is turned off in database: hide immediately!
          setIsEnabled(false);
          setBannerItem(null);
          setDismissed(false);
          setAnimateIn(false);
          activeItemIdRef.current = null;
          return;
        }
      }

      // 2. Fallback to settings ONLY if announcements table could not be fetched
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["promo_banner_enabled", "promo_banner_text"]);

      if (data && data.length > 0) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        const enabled = map.promo_banner_enabled === "true" && !!map.promo_banner_text?.trim();

        if (enabled) {
          const text = map.promo_banner_text.trim();
          setBannerItem(null);
          setBannerText(text);
          setIsEnabled(true);
          setDismissed(false);
          activeItemIdRef.current = "fallback_settings";
          setTimeout(() => setAnimateIn(true), 100);
        } else {
          setIsEnabled(false);
          setBannerItem(null);
          setDismissed(false);
          setAnimateIn(false);
          activeItemIdRef.current = null;
        }
      } else {
        setIsEnabled(false);
        setBannerItem(null);
        setDismissed(false);
        setAnimateIn(false);
        activeItemIdRef.current = null;
      }
    } catch (e) {
      // Non-blocking
    }
  }, [supabase]);

  // When the user presses the 'X' button on the banner:
  // Hides the banner and automatically sets show_banner to false on the database (auto toggles off on admin)
  const handleDismiss = async () => {
    // 1. Immediately animate out in UI
    setAnimateIn(false);
    setTimeout(() => {
      setDismissed(true);
      setIsEnabled(false);
    }, 300);

    // 2. Persist directly to the database
    try {
      await dismissAnnouncementBannerAction(bannerItem?.id);
    } catch (e) {
      console.error("Failed to dismiss banner in database:", e);
    }
  };

  useEffect(() => {
    fetchBanner();

    // Supabase Realtime for instant updates whenever admin or user changes database state
    const channel = supabase
      .channel("announcement-toast-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        fetchBanner();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchBanner();
      })
      .subscribe();

    // Polling fallback every 10s for consistency
    const interval = setInterval(fetchBanner, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchBanner, supabase]);

  if (isExcludedPage || !isEnabled || dismissed || !bannerText) {
    return null;
  }

  return (
    <div
      aria-label="Announcement"
      role="alert"
      className={`fixed top-20 right-4 z-[999] w-[320px] sm:w-[360px] transition-all duration-500 ease-out pointer-events-auto ${
        animateIn ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12 pointer-events-none"
      }`}
    >
      <div className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-2xl shadow-2xl border border-[#c9a84c]/40 overflow-hidden">
        {/* Gold shimmer accent top line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
        >
          <X size={14} />
        </button>

        <div className="p-4 pr-9">
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
              {bannerItem?.badge || "Announcement"}
            </span>
          </div>

          {/* Message text */}
          <p className="text-[13px] text-white/90 leading-relaxed font-medium">
            {bannerText}
          </p>

          {/* CTA link */}
          <Link
            href={bannerItem?.link_url || "/announcements"}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c9a84c] hover:text-white transition-colors group"
          >
            {bannerItem?.link_text || "View Details"}
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Bottom shimmer */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" />
      </div>
    </div>
  );
}
