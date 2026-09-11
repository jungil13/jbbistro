"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Sparkles, Clock, ArrowRight, BellRing, Tag, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AnnouncementItem, getAnnouncements } from "@/app/actions/announcements";

export default function AnnouncementsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "promotions" | "announcements">("all");

  const loadData = async () => {
    try {
      const res = await getAnnouncements();
      if (res.success && res.data) {
        // Only show active items on public page
        setItems(res.data.filter((i) => i.is_active));
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
    if (filter === "promotions") return item.type === "promotion";
    if (filter === "announcements") return item.type === "announcement";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Navbar />

      {/* Hero Banner */}
      <div
        className="relative pt-[68px] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.93)] via-[rgba(107,16,32,0.85)] to-[rgba(30,5,10,0.95)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 text-[#c9a84c] text-xs font-bold tracking-wider uppercase mb-4">
            <BellRing size={13} />
            Exclusive Offers &amp; Updates
          </div>
          <h1
            className="font-playfair text-[clamp(2rem,5vw,3.4rem)] font-bold text-white leading-[1.15] mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Announcements &amp; Promotions
          </h1>
          <p className="text-white/70 text-sm max-w-[500px] mx-auto leading-[1.8]">
            Discover our latest culinary promotions, VIP karaoke specials, exclusive events, and news from Jbenz Bistro.
          </p>

          {/* Filter Pills */}
          <div className="mt-8 inline-flex items-center gap-1.5 p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/80">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-1.5 rounded-full transition-all ${
                filter === "all" ? "bg-[#c9a84c] text-[#3d0a14] shadow-md font-bold" : "hover:text-white"
              }`}
            >
              All Updates ({items.length})
            </button>
            <button
              onClick={() => setFilter("promotions")}
              className={`px-4 py-1.5 rounded-full transition-all ${
                filter === "promotions" ? "bg-[#c9a84c] text-[#3d0a14] shadow-md font-bold" : "hover:text-white"
              }`}
            >
              Promotions ({items.filter((i) => i.type === "promotion").length})
            </button>
            <button
              onClick={() => setFilter("announcements")}
              className={`px-4 py-1.5 rounded-full transition-all ${
                filter === "announcements" ? "bg-[#c9a84c] text-[#3d0a14] shadow-md font-bold" : "hover:text-white"
              }`}
            >
              Announcements ({items.filter((i) => i.type === "announcement").length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-5 py-14">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200/60 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-900 flex items-center justify-center mx-auto mb-4">
              <BellRing size={28} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">No Active Updates</h2>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              There are no active promotions or announcements under this category right now. Please check back soon!
            </p>
            <Link
              href="/reserve"
              className="inline-flex items-center gap-2 bg-red-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-800 transition-colors shadow-md"
            >
              Book a Reservation <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {displayedItems.map((item) => {
              const isAnnouncement = item.type === "announcement";

              if (isAnnouncement) {
                return (
                  <div
                    key={item.id}
                    className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-3xl shadow-xl border border-[#c9a84c]/40 overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" />

                    <div className="flex flex-col md:flex-row items-stretch">
                      {item.image_url && (
                        <div className="md:w-72 h-48 md:h-auto flex-shrink-0 relative overflow-hidden bg-black/20">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/60 to-transparent" />
                        </div>
                      )}

                      <div className="p-7 sm:p-9 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap mb-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#c9a84c] text-[#3d0a14]">
                              <Megaphone size={11} /> Announcement
                            </span>
                            {item.badge && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/20">
                                {item.badge}
                              </span>
                            )}
                            {item.validity && (
                              <span className="text-xs text-white/70 flex items-center gap-1 font-medium">
                                <Clock size={12} className="text-[#c9a84c]" /> {item.validity}
                              </span>
                            )}
                          </div>

                          <h2
                            className="text-2xl sm:text-3xl font-bold text-white mb-3"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {item.title}
                          </h2>
                          <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6 font-normal">
                            {item.description}
                          </p>
                        </div>

                        {item.link_url && (
                          <div>
                            <Link
                              href={item.link_url}
                              className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#e2c46a] text-[#3d0a14] px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md"
                            >
                              {item.link_text || "Learn More"} <ArrowRight size={15} />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Promotion Card
              return (
                <div
                  key={item.id}
                  className="relative bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all"
                >
                  <div className="h-1 bg-gradient-to-r from-[#3d0a14] via-[#c9a84c] to-[#3d0a14]" />

                  <div className="flex flex-col md:flex-row items-stretch">
                    {item.image_url && (
                      <div className="md:w-80 h-56 md:h-auto flex-shrink-0 relative overflow-hidden bg-gray-100">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-4 left-4">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#3d0a14] text-[#c9a84c] shadow-md">
                            {item.badge || "Special Offer"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-7 sm:p-9 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap mb-3">
                          {!item.image_url && (
                            <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#3d0a14] text-[#c9a84c]">
                              {item.badge || "Special Offer"}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <Sparkles size={11} /> Promotion
                          </span>
                          {item.validity && (
                            <span className="text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                              <Clock size={12} className="text-[#c9a84c]" />
                              {item.validity}
                            </span>
                          )}
                        </div>

                        <h2
                          className="text-2xl sm:text-3xl font-bold text-[#3d0a14] mb-3 leading-tight"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {item.title}
                        </h2>
                        <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                          {item.description}
                        </p>
                      </div>

                      {item.link_url && (
                        <div>
                          <Link
                            href={item.link_url}
                            className="inline-flex items-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-[#3d0a14]/20"
                          >
                            {item.link_text || "Claim This Offer"} <ArrowRight size={15} />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
