"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Sparkles, Clock, ArrowRight, BellRing } from "lucide-react";
import Link from "next/link";

export default function AnnouncementsPage() {
  const supabase = createClient();
  const [promo, setPromo] = useState<{
    enabled: boolean;
    badge: string;
    title: string;
    description: string;
    validity: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState<{
    enabled: boolean;
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
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
            "promo_banner_enabled",
            "promo_banner_text",
          ]);

        if (data) {
          const map = Object.fromEntries(data.map((r) => [r.key, r.value]));

          setPromo({
            enabled: map.promo_enabled !== "false",
            badge: map.promo_badge || "Exclusive Promo",
            title: map.promo_title || "Weekend VIP Karaoke & Pulutan Fiesta",
            description:
              map.promo_description ||
              "Book any VIP Karaoke Suite or Dining Table this Friday through Sunday and enjoy 20% off your booking, plus a complimentary signature Pulutan Platter and drinks on the house!",
            validity: map.promo_validity || "Every Fri - Sun • 5:00 PM to Midnight",
          });

          setAnnouncement({
            enabled: map.promo_banner_enabled !== "false",
            text:
              map.promo_banner_text ||
              "🎉 Special Promo: 20% Off All VIP Karaoke Suites this Weekend! Free Pulutan Platter with every booking.",
          });
        }
      } catch (e) {
        // keep defaults
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Real-time updates
    const channel = supabase
      .channel("announcements-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const hasContent =
    (promo?.enabled) || (announcement?.enabled);

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
            Latest Updates
          </div>
          <h1
            className="font-playfair text-[clamp(2rem,5vw,3.4rem)] font-bold text-white leading-[1.15] mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Announcements &amp; Promotions
          </h1>
          <p className="text-white/70 text-sm max-w-[480px] mx-auto leading-[1.8]">
            Stay up to date with our latest offers, events, and news from Jbenz Bistro.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-5 py-14 space-y-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : !hasContent ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <BellRing size={28} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-400 mb-1">No Active Announcements</h2>
            <p className="text-sm text-gray-400">Check back soon for updates and promos!</p>
          </div>
        ) : (
          <>
            {/* Announcement Card */}
            {announcement?.enabled && (
              <div className="relative bg-gradient-to-br from-[#2a060e] via-[#4d0c1b] to-[#3d0a14] text-white rounded-3xl shadow-2xl border border-[#c9a84c]/40 overflow-hidden p-8 sm:p-10">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" />

                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0 mt-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a84c] opacity-50" />
                    <div className="relative w-10 h-10 rounded-full bg-[#c9a84c] text-[#3d0a14] flex items-center justify-center shadow-md">
                      <Megaphone size={18} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c9a84c] block mb-2">
                      Announcement
                    </span>
                    <p className="text-white/90 text-base sm:text-lg leading-relaxed font-medium">
                      {announcement.text}
                    </p>
                    <Link
                      href="/reserve"
                      className="mt-5 inline-flex items-center gap-2 bg-[#c9a84c] text-[#3d0a14] px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#e2c46a] transition-colors shadow-md"
                    >
                      Reserve Now <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Promo Card */}
            {promo?.enabled && (
              <div className="relative bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Top accent */}
                <div className="h-1 bg-gradient-to-r from-[#3d0a14] via-[#c9a84c] to-[#3d0a14]" />

                <div className="p-8 sm:p-10">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={22} className="text-[#c9a84c]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#3d0a14] text-[#c9a84c]">
                          {promo.badge}
                        </span>
                        {promo.validity && (
                          <span className="text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                            <Clock size={12} className="text-[#c9a84c]" />
                            {promo.validity}
                          </span>
                        )}
                      </div>
                      <h2
                        className="text-2xl sm:text-3xl font-bold text-[#3d0a14] mb-3 leading-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {promo.title}
                      </h2>
                      <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                        {promo.description}
                      </p>
                      <Link
                        href="/reserve"
                        className="inline-flex items-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-[#3d0a14]/20"
                      >
                        Claim This Offer <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
