"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, Megaphone, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAnnouncements,
  AnnouncementItem,
} from "@/app/actions/announcements";

function isExpired(validUntil?: string | null): boolean {
  if (!validUntil) return false;
  try {
    const expiry = new Date(validUntil.includes("T") ? validUntil : `${validUntil}T23:59:59`).getTime();
    return !isNaN(expiry) && expiry < Date.now();
  } catch {
    return false;
  }
}

export default function AnnouncementBanner() {
  const pathname = usePathname();
  const supabase = createClient();

  const [queue, setQueue] = useState<AnnouncementItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Do not show floating banner on management or receipt pages
  const isExcludedPage =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/manager") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/receipt");

  const buildCandidates = useCallback(async (): Promise<AnnouncementItem[]> => {
    try {
      // 1. Direct real-time fetch from Supabase
      let items: AnnouncementItem[] = [];
      const { data: dbData, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .eq("show_banner", true)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(dbData) && dbData.length > 0) {
        items = dbData;
      } else {
        // Fallback to server action getAnnouncements
        const res = await getAnnouncements();
        if (res.success && Array.isArray(res.data)) {
          items = res.data.filter((i) => i.is_active && i.show_banner);
        }
      }

      // 2. Filter unexpired items
      let candidates = items.filter((item) => {
        if (isExpired(item.valid_until)) return false;
        return true;
      });

      // 3. Ensure order: latest announcement on top ([0]), second announcement directly below ([1])
      candidates.sort((a, b) => {
        const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
        const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
        return timeB - timeA; // Descending: newest first
      });

      // 4. Legacy fallback to settings table if no announcements configured
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
            candidates = [
              {
                id: fallbackId,
                type: "announcement",
                title: "Notice",
                description: text,
                is_active: true,
                show_banner: true,
                sort_order: 0,
                link_url: "",
                link_text: "",
              },
            ];
          }
        }
      }

      return candidates;
    } catch {
      return [];
    }
  }, [supabase]);

const DISMISSED_STORAGE_KEY = "jbbistro_dismissed_announcements";

  const refreshQueue = useCallback(async () => {
    const candidates = await buildCandidates();
    setQueue(candidates);
  }, [buildCandidates]);

  // Load dismissed announcement IDs from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setDismissedIds(new Set(parsed));
          }
        }
      } catch (e) {
        console.warn("Failed to read dismissed announcements from localStorage:", e);
      }
    }
  }, []);

  useEffect(() => {
    // Initial load
    refreshQueue();

    // Realtime Postgres subscription
    const channel = supabase
      .channel("announcement-toast-realtime-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        refreshQueue();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        refreshQueue();
      })
      .subscribe();

    // Fast polling fallback so local updates appear immediately
    const interval = setInterval(refreshQueue, 2500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refreshQueue, supabase]);

  const handleDismissItem = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch (e) {
          console.warn("Failed to persist dismissed announcement to localStorage:", e);
        }
      }
      return next;
    });
  };

  // Filter out banners dismissed during current in-page view
  const visibleQueue = queue.filter((item) => !dismissedIds.has(item.id));

  if (isExcludedPage || visibleQueue.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Active Announcements"
      role="region"
      className="fixed top-20 right-3 sm:right-5 z-[99] w-[calc(100vw-1.5rem)] sm:w-[380px] max-w-[390px] flex flex-col gap-3 pointer-events-auto print:hidden"
    >
      {visibleQueue.map((item, idx) => {
        const badgeLabel = item.badge || (item.type === "promotion" ? "Promotion" : "Announcement");
        return (
          <div
            key={item.id}
            role="alert"
            className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-2xl shadow-[0_12px_40px_rgba(42,6,14,0.45)] border border-[#c9a84c]/40 overflow-hidden backdrop-blur-md transition-all duration-300 ease-out animate-in fade-in slide-in-from-right-4"
          >
            {/* Gold shimmer accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent animate-pulse" />

            <div className="p-4 sm:p-5">
              {/* Top row: badge, order indicator if multiple, dismiss button */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/50 text-[#c9a84c] flex-shrink-0">
                    <Megaphone size={11} />
                    {badgeLabel}
                  </span>
                  {visibleQueue.length > 1 && (
                    <span className="text-[10px] font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      {idx + 1} of {visibleQueue.length}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDismissItem(item.id)}
                  aria-label="Dismiss banner"
                  title="Dismiss banner"
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-[#c9a84c]/30 text-white/70 hover:text-[#c9a84c] flex items-center justify-center transition-all flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Title */}
              <h4
                className="text-sm font-bold text-white mb-1 leading-snug line-clamp-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {item.title}
              </h4>

              {/* Description */}
              {item.description && (
                <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-2">
                  {item.description}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                <span className="text-[11px] text-white/40">Jbenz Bistro Official Notice</span>
                {item.validity && (
                  <span className="text-[11px] text-white/60 flex items-center gap-1 font-medium truncate max-w-[170px]">
                    <Clock size={11} className="text-[#c9a84c] flex-shrink-0" />
                    <span className="truncate">{item.validity}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
