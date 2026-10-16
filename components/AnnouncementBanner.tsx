"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X, Megaphone, Sparkles, Clock, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAnnouncements,
  AnnouncementItem,
} from "@/app/actions/announcements";

const DISMISSED_STORAGE_KEY = "jbbistro_dismissed_banners_v1";

interface DismissalRecord {
  dismissedAt: number;
  updatedAt?: string | null;
  signature?: string;
}

interface DismissalMap {
  [itemId: string]: DismissalRecord;
}

function getDismissedMap(): DismissalMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isBannerDismissed(id: string, updatedAt?: string | null, signature?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const map = getDismissedMap();
    const record = map[id];
    if (!record) return false;

    // If admin updated the announcement or changed its content, show the fresh update
    if (updatedAt && record.updatedAt && updatedAt !== record.updatedAt) {
      return false;
    }
    if (signature && record.signature && signature !== record.signature) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function saveBannerDismissed(id: string, updatedAt?: string | null, signature?: string) {
  if (typeof window === "undefined") return;
  try {
    const map = getDismissedMap();
    map[id] = {
      dismissedAt: Date.now(),
      updatedAt: updatedAt || null,
      signature: signature || "",
    };
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to store banner dismissal locally:", e);
  }
}

export default function AnnouncementBanner() {
  const pathname = usePathname();
  const [bannerItem, setBannerItem] = useState<AnnouncementItem | null>(null);
  const [bannerText, setBannerText] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
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
          const sig = `${item.title}_${item.description || ""}`;
          // Check if THIS designated customer has dismissed this specific announcement
          if (isBannerDismissed(item.id, item.updated_at, sig)) {
            setIsEnabled(false);
            setBannerItem(null);
            setDismissed(true);
            setAnimateIn(false);
            activeItemIdRef.current = item.id;
            return;
          }

          const desc = item.description?.trim() || "";
          const title = item.title?.trim() || "";
          const text = desc || title;

          setBannerItem(item);
          setBannerTitle(title);
          setBannerText(text);
          setIsEnabled(true);
          setDismissed(false);
          activeItemIdRef.current = item.id;
          setTimeout(() => setAnimateIn(true), 80);
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
          const fallbackId = `settings_${encodeURIComponent(text.slice(0, 32))}`;

          if (isBannerDismissed(fallbackId, null, text)) {
            setIsEnabled(false);
            setBannerItem(null);
            setDismissed(true);
            setAnimateIn(false);
            activeItemIdRef.current = fallbackId;
            return;
          }

          setBannerItem(null);
          setBannerTitle("Notice");
          setBannerText(text);
          setIsEnabled(true);
          setDismissed(false);
          activeItemIdRef.current = fallbackId;
          setTimeout(() => setAnimateIn(true), 80);
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
  // Hides the banner for THIS designated user ONLY without mutating admin settings or other users!
  const handleDismiss = () => {
    // 1. Immediately animate out in UI
    setAnimateIn(false);
    setTimeout(() => {
      setDismissed(true);
      setIsEnabled(false);
    }, 300);

    // 2. Persist dismissal in localStorage for this customer's browser only
    if (bannerItem?.id) {
      const sig = `${bannerItem.title}_${bannerItem.description || ""}`;
      saveBannerDismissed(bannerItem.id, bannerItem.updated_at, sig);
    } else if (activeItemIdRef.current) {
      saveBannerDismissed(activeItemIdRef.current, null, bannerText);
    }
  };

  useEffect(() => {
    fetchBanner();

    // Supabase Realtime for instant updates whenever admin toggles or edits announcements
    const channel = supabase
      .channel("announcement-toast-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        fetchBanner();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchBanner();
      })
      .subscribe();

    // Periodic check fallback every 15s
    const interval = setInterval(fetchBanner, 15000);

    // Listen for storage events across other tabs of the same user
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === DISMISSED_STORAGE_KEY && activeItemIdRef.current) {
        if (isBannerDismissed(activeItemIdRef.current)) {
          setAnimateIn(false);
          setDismissed(true);
          setIsEnabled(false);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchBanner, supabase]);

  if (isExcludedPage || !isEnabled || dismissed || !bannerText) {
    return null;
  }

  const isPromotion = bannerItem?.type === "promotion";
  const badgeLabel = bannerItem?.badge || (isPromotion ? "Exclusive Promo" : "Announcement");
  const showDistinctTitle = bannerTitle && bannerItem?.description && bannerTitle !== bannerItem.description;

  return (
    <div
      aria-label="Announcement"
      role="alert"
      className={`fixed top-20 right-3 sm:right-5 z-[99] w-[calc(100vw-1.5rem)] sm:w-[380px] max-w-[390px] transition-all duration-500 ease-out pointer-events-auto ${
        animateIn ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10 pointer-events-none"
      }`}
    >
      <div className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-2xl shadow-2xl border border-[#c9a84c]/40 overflow-hidden backdrop-blur-md">
        {/* Gold shimmer accent top line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

        {/* Dismiss button (Designated user only) */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss announcement banner"
          title="Dismiss for this session"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer z-10"
        >
          <X size={14} />
        </button>

        <div className="p-4 pr-10">
          {/* Header with Icon, Badge & Validity */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Pulsing icon */}
            <div className="relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a84c] opacity-60" />
              <div className="relative w-6 h-6 rounded-full bg-[#c9a84c] text-[#3d0a14] flex items-center justify-center shadow-md">
                {isPromotion ? <Sparkles size={12} /> : <Megaphone size={12} />}
              </div>
            </div>

            {/* Badge */}
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded-md border border-[#c9a84c]/20">
              {badgeLabel}
            </span>

            {/* Validity indicator */}
            {bannerItem?.validity && (
              <span className="text-[10px] text-white/70 flex items-center gap-1 bg-black/25 px-2 py-0.5 rounded-md">
                <Clock size={10} className="text-[#c9a84c]" />
                <span className="truncate max-w-[150px]">{bannerItem.validity}</span>
              </span>
            )}
          </div>

          {/* Content area */}
          <div className="flex items-start gap-3">
            {/* Optional preview thumbnail */}
            {bannerItem?.image_url && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[#c9a84c]/30 shadow-sm bg-black/20">
                <img
                  src={bannerItem.image_url}
                  alt={bannerTitle || "Announcement"}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Separate title if provided */}
              {showDistinctTitle && (
                <h4 className="text-[13px] font-bold text-white leading-snug line-clamp-1 mb-0.5">
                  {bannerTitle}
                </h4>
              )}

              {/* Message text */}
              <p className="text-[12px] text-white/90 leading-relaxed font-normal line-clamp-3">
                {bannerText}
              </p>
            </div>
          </div>

          {/* CTA link */}
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10">
            <Link
              href={bannerItem?.link_url || "/announcements"}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c9a84c] hover:text-white transition-colors group"
            >
              <span>{bannerItem?.link_text || "View Details"}</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <span className="text-[9px] text-white/40 tracking-wider">
              Jbenz Bistro
            </span>
          </div>
        </div>

        {/* Bottom shimmer */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" />
      </div>
    </div>
  );
}
