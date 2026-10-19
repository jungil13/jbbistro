"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Clock, ArrowRight, BellRing, Tag, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { AnnouncementItem, getAnnouncements } from "@/app/actions/announcements";

export default function AnnouncementsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      const res = await getAnnouncements();
      if (res.success && res.data) {
        // Only show active announcement items
        setItems(
          res.data.filter(
            (i) => i.is_active && (i.type === "announcement" || (i.type as string) !== "promotion")
          )
        );
      }
    } catch (e) {
      console.error("Error loading public announcements:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Real-time updates from announcements and settings
    const channel = supabase
      .channel("announcements-public-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayedItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Banner */}
        <div
          className="relative pt-[68px] overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.94)] via-[rgba(107,16,32,0.88)] to-[rgba(30,5,10,0.96)]" />
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 text-[#c9a84c] text-xs font-bold tracking-wider uppercase mb-4">
              <Megaphone size={13} />
              News &amp; Official Notices
            </div>
            <h1
              className="font-playfair text-[clamp(2.2rem,5vw,3.6rem)] font-bold text-white leading-[1.15] mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Announcements
            </h1>
            <p className="text-white/80 text-sm sm:text-base max-w-[540px] mx-auto leading-relaxed mb-6 font-normal">
              Stay up-to-date with the latest notices, holiday operating schedules, live entertainment, and updates from Jbenz Bistro.
            </p>

            {/* Link to promotions banner */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white/90">
              <Sparkles size={14} className="text-[#c9a84c]" />
              <span>Looking for discounts &amp; dining vouchers?</span>
              <Link
                href="/promotions"
                className="font-bold text-[#c9a84c] hover:text-[#f0d68b] transition-colors underline flex items-center gap-1 ml-1"
              >
                Browse Promotions <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="max-w-5xl mx-auto px-5 py-12">
          {/* Search bar & count */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#3d0a14]">
                All Announcements ({displayedItems.length})
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search announcements..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-full focus:outline-none focus:border-[#c9a84c] text-gray-800 shadow-sm transition-all"
              />
            </div>
          </div>

          {/* List or Loading State */}
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 bg-gray-200/60 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm max-w-lg mx-auto p-8">
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-900 flex items-center justify-center mx-auto mb-4">
                <BellRing size={28} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">No Announcements Found</h2>
              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
                {search.trim()
                  ? `No announcements match "${search}". Try searching with different keywords.`
                  : "There are no active announcements at this time. Please check back soon or browse our dining services."}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/promotions"
                  className="inline-flex items-center gap-2 bg-[#3d0a14] text-gold px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#5c1020] transition-colors shadow-sm"
                >
                  <Sparkles size={14} /> View Promotions
                </Link>
                <Link
                  href="/reserve"
                  className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
                >
                  Book a Table <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-3xl shadow-lg border border-[#c9a84c]/30 overflow-hidden hover:border-[#c9a84c]/60 transition-all duration-300"
                >
                  {/* Gold shimmer border accents */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

                  <div className="flex flex-col md:flex-row items-stretch">
                    {/* Optional banner photo */}
                    {item.image_url && (
                      <div className="md:w-72 h-52 md:h-auto flex-shrink-0 relative overflow-hidden bg-black/30">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
                      </div>
                    )}

                    {/* Announcement text & details */}
                    <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Badges row */}
                        <div className="flex items-center gap-2.5 flex-wrap mb-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#c9a84c] text-[#3d0a14] shadow-sm">
                            <Megaphone size={10} /> Announcement
                          </span>
                          {item.badge && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/20">
                              <Tag size={10} /> {item.badge}
                            </span>
                          )}
                          {item.validity && (
                            <span className="text-xs text-white/70 flex items-center gap-1 font-medium ml-auto">
                              <Clock size={12} className="text-[#c9a84c]" /> {item.validity}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h2
                          className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {item.title}
                        </h2>

                        {/* Description */}
                        <p className="text-white/80 text-xs sm:text-sm leading-relaxed mb-6 font-normal whitespace-pre-line">
                          {item.description}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/50">Jbenz Bistro Official Notice</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
