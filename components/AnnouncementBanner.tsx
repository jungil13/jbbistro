"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAnnouncements, AnnouncementItem } from "@/app/actions/announcements";

function checkIsDismissed(item: AnnouncementItem | null, text: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (item?.id) {
      if (
        localStorage.getItem(`announcement_dismissed_${item.id}`) === "true" ||
        sessionStorage.getItem(`announcement_dismissed_${item.id}`) === "true"
      ) {
        return true;
      }
    }
    if (text) {
      const cleanText = text.trim();
      if (
        localStorage.getItem(`announcement_dismissed_text_${cleanText}`) === "true" ||
        sessionStorage.getItem(`announcement_dismissed_text_${cleanText}`) === "true"
      ) {
        return true;
      }
    }
    if (sessionStorage.getItem("announcement_user_dismissed") === "true") {
      return true;
    }
  } catch (e) {
    // Ignore storage errors in restricted contexts
  }
  return false;
}

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
      // 1. Check active announcement banner from database
      const res = await getAnnouncements();
      if (res.success && Array.isArray(res.data)) {
        // Only show if active AND designated to show as banner toast
        const item = res.data.find((i) => i.is_active && i.show_banner);

        if (item) {
          const text = item.description || item.title;
          const wasDismissed = checkIsDismissed(item, text);

          setBannerItem(item);
          setBannerText(text);
          setIsEnabled(true);
          activeItemIdRef.current = item.id;

          if (wasDismissed) {
            setDismissed(true);
            setAnimateIn(false);
          } else {
            setDismissed(false);
            setTimeout(() => setAnimateIn(true), 100);
          }
          return;
        } else {
          // Admin deactivated announcement or turned banner off: hide immediately!
          setIsEnabled(false);
          setBannerItem(null);
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
          const wasDismissed = checkIsDismissed(null, text);

          setBannerItem(null);
          setBannerText(text);
          setIsEnabled(true);
          activeItemIdRef.current = "fallback_settings";

          if (wasDismissed) {
            setDismissed(true);
            setAnimateIn(false);
          } else {
            setDismissed(false);
            setTimeout(() => setAnimateIn(true), 100);
          }
        } else {
          setIsEnabled(false);
          setBannerItem(null);
          setAnimateIn(false);
          activeItemIdRef.current = null;
        }
      } else {
        setIsEnabled(false);
        setBannerItem(null);
        setAnimateIn(false);
        activeItemIdRef.current = null;
      }
    } catch (e) {
      // Non-blocking
    }
  }, [supabase]);

  const handleDismiss = () => {
    setAnimateIn(false);
    setTimeout(() => setDismissed(true), 350);

    try {
      if (bannerItem?.id) {
        localStorage.setItem(`announcement_dismissed_${bannerItem.id}`, "true");
        sessionStorage.setItem(`announcement_dismissed_${bannerItem.id}`, "true");
      }
      if (bannerText) {
        const clean = bannerText.trim();
        localStorage.setItem(`announcement_dismissed_text_${clean}`, "true");
        sessionStorage.setItem(`announcement_dismissed_text_${clean}`, "true");
      }
      sessionStorage.setItem("announcement_user_dismissed", "true");
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchBanner();

    // Supabase Realtime for instant admin activation / deactivation updates
    const channel = supabase
      .channel("announcement-toast-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        fetchBanner();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchBanner();
      })
      .subscribe();

    // Polling fallback every 10s to ensure multi-tab / server sync
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
