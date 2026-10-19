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

const DISMISSED_STORAGE_KEY = "jbbistro_dismissed_banners_v2";

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

function isExpired(validUntil?: string | null): boolean {
  if (!validUntil) return false;
  try {
    // Valid until end of the given day
    const expiry = new Date(validUntil.includes("T") ? validUntil : `${validUntil}T23:59:59`).getTime();
    return !isNaN(expiry) && expiry < Date.now();
  } catch {
    return false;
  }
}

export default function AnnouncementBanner() {
  const pathname = usePathname();
  const [queue, setQueue] = useState<AnnouncementItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animateIn, setAnimateIn] = useState(false);
  const supabase = createClient();

  // Hide banner on admin, manager, or auth pages
  const isExcludedPage =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/manager") ||
    pathname?.startsWith("/login");

  const fetchBanners = useCallback(async () => {
    try {
      const res = await getAnnouncements();
      let candidates: AnnouncementItem[] = [];

      if (res.success && Array.isArray(res.data)) {
        candidates = res.data.filter((item) => {
          if (!item.is_active || !item.show_banner) return false;
          if (isExpired((item as any).valid_until)) return false;
          const sig = `${item.title}_${item.description || ""}`;
          if (isBannerDismissed(item.id, item.updated_at, sig)) return false;
          return true;
        });
      }

      // Fallback check to settings table if no candidates from announcements
      if (candidates.length === 0) {
        const { data } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", ["promo_banner_enabled", "promo_banner_text"]);

        if (data && data.length > 0) {
          const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
          if (map.promo_banner_enabled === "true" && map.promo_banner_text?.trim()) {
            const text = map.promo_banner_text.trim();
            const fallbackId = `settings_${encodeURIComponent(text.slice(0, 32))}`;
            if (!isBannerDismissed(fallbackId, null, text)) {
              candidates = [
                {
                  id: fallbackId,
                  type: "announcement",
                  title: "Notice",
                  description: text,
                  is_active: true,
                  show_banner: true,
                  sort_order: 0,
                  link_url: "/announcements",
                  link_text: "View Details",
                },
              ];
            }
          }
        }
      }

      setQueue(candidates);
      setCurrentIndex(0);

      if (candidates.length > 0) {
        setTimeout(() => setAnimateIn(true), 120);
      } else {
        setAnimateIn(false);
      }
    } catch (e) {
      // Non-blocking
    }
  }, [supabase]);

  const handleDismissCurrent = () => {
    const currentItem = queue[currentIndex];
    if (currentItem) {
      const sig = `${currentItem.title}_${currentItem.description || ""}`;
      saveBannerDismissed(currentItem.id, currentItem.updated_at, sig);
    }

    // Animate out
    setAnimateIn(false);

    // After animation, check if next announcement is available in the queue
    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex < queue.length) {
        setCurrentIndex(nextIndex);
        setTimeout(() => setAnimateIn(true), 150);
      } else {
        // All eligible announcements in queue have been dismissed
        setQueue([]);
      }
    }, 350);
  };

  useEffect(() => {
    fetchBanners();

    // Supabase Realtime for instant updates whenever admin toggles or edits announcements
    const channel = supabase
      .channel("announcement-toast-realtime-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        fetchBanners();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchBanners();
      })
      .subscribe();

    const interval = setInterval(fetchBanners, 20000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchBanners, supabase]);

  if (isExcludedPage || queue.length === 0 || currentIndex >= queue.length) {
    return null;
  }

  const currentItem = queue[currentIndex];
  const isPromotion = currentItem.type === "promotion";
  const badgeLabel = currentItem.badge || (isPromotion ? "Exclusive Promo" : "Announcement");
  const totalInQueue = queue.length;
  const currentStep = currentIndex + 1;

  return (
    <div
      aria-label="Announcement"
      role="alert"
      className={`fixed top-20 right-3 sm:right-5 z-[99] w-[calc(100vw-1.5rem)] sm:w-[380px] max-w-[390px] transition-all duration-500 ease-out pointer-events-auto ${
        animateIn ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10 pointer-events-none"
      }`}
    >
      <div className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-2xl shadow-[0_12px_40px_rgba(42,6,14,0.45)] border border-[#c9a84c]/40 overflow-hidden backdrop-blur-md">
        {/* Shimmer top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent animate-pulse" />

        <div className="p-4 sm:p-5">
          {/* Top Row: Type Pill, Queue counter, Close Button */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/50 text-[#c9a84c]">
                {isPromotion ? <Sparkles size={11} /> : <Megaphone size={11} />}
                {badgeLabel}
              </span>
              {totalInQueue > 1 && (
                <span className="text-[10px] font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                  {currentStep} of {totalInQueue}
                </span>
              )}
            </div>

            <button
              onClick={handleDismissCurrent}
              aria-label="Dismiss this announcement"
              title={totalInQueue > currentStep ? "Next Announcement" : "Close"}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Title */}
          <h4
            className="text-sm font-bold text-white mb-1 leading-snug line-clamp-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {currentItem.title}
          </h4>

          {/* Description */}
          {currentItem.description && (
            <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-3">
              {currentItem.description}
            </p>
          )}

          {/* Footer Action and Validity */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
            {currentItem.validity ? (
              <span className="text-[11px] text-white/60 flex items-center gap-1 font-medium">
                <Clock size={11} className="text-[#c9a84c]" />
                {currentItem.validity}
              </span>
            ) : (
              <span className="text-[11px] text-white/40">Jbenz Bistro</span>
            )}

            <Link
              href={currentItem.link_url || "/announcements"}
              onClick={handleDismissCurrent}
              className="inline-flex items-center gap-1 font-bold text-[#c9a84c] hover:text-[#e0c46e] text-xs transition-colors"
            >
              <span>{currentItem.link_text || (isPromotion ? "Claim Offer" : "View Details")}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
