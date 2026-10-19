"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Sparkles, Clock, ArrowRight, BellRing, Tag, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AnnouncementItem, getAnnouncements } from "@/app/actions/announcements";
import { claimPromotionAction, getCustomerPromotionClaimsAction, PromotionClaimRecord } from "@/app/actions/promotions";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function AnnouncementsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "promotions" | "announcements" | "my_promos">("all");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userClaims, setUserClaims] = useState<PromotionClaimRecord[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

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

  const loadUserAndClaims = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) setProfile(prof);
      const claims = await getCustomerPromotionClaimsAction(user.id);
      setUserClaims(claims);
    }
  };

  useEffect(() => {
    loadData();
    loadUserAndClaims();

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

  const handleClaimPromo = async (promo: AnnouncementItem) => {
    if (!user) {
      toast.error("Please sign in to claim this promotion!", { icon: "🔒" });
      router.push("/login?redirect=/announcements");
      return;
    }

    setClaimingId(promo.id);
    try {
      const customerName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : (user.email?.split("@")[0] || "Customer");
      const res = await claimPromotionAction({
        promotion_id: promo.id,
        promotion_title: promo.title,
        customer_id: user.id,
        customer_name: customerName || "Customer",
        customer_email: user.email || "",
        customer_phone: profile?.phone || "",
        discount_percent: 15,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to claim promo");
      } else {
        toast.success("Promo claimed successfully! Awaiting admin review.", { icon: "🎉" });
        await loadUserAndClaims();
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setClaimingId(null);
    }
  };

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
          <div className="mt-8 inline-flex items-center gap-1.5 p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/80 flex-wrap justify-center">
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
            {user && (
              <button
                onClick={() => setFilter("my_promos")}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  filter === "my_promos" ? "bg-amber-400 text-[#3d0a14] shadow-md font-bold" : "hover:text-white"
                }`}
              >
                My Claimed Promos ({userClaims.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-5 py-14">
        {filter === "my_promos" ? (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#3d0a14]">My Claimed Promotions</h2>
              <p className="text-sm text-gray-500 mt-1">Track the approval status of your claimed promos and apply approved discounts when reserving.</p>
            </div>

            {userClaims.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <Tag size={36} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-base font-bold text-gray-700">No Claimed Promotions Yet</h3>
                <p className="text-xs text-gray-400 mt-1 mb-5">Browse our active promotions and click "Claim Promo" to request your discount.</p>
                <button
                  onClick={() => setFilter("promotions")}
                  className="px-5 py-2.5 rounded-xl bg-[#3d0a14] text-gold font-bold text-xs hover:bg-[#5c1020] transition-colors"
                >
                  Browse Promotions
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {userClaims.map((claim) => (
                  <div key={claim.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-extrabold text-[#c9a84c] uppercase tracking-wider">
                          {claim.discount_percent}% Off Discount
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            claim.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : claim.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : claim.status === "used"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {claim.status === "approved"
                            ? "Approved & Ready"
                            : claim.status === "pending"
                            ? "Pending Approval"
                            : claim.status === "used"
                            ? "Applied on Booking"
                            : "Rejected"}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#3d0a14] mb-1">{claim.promotion_title}</h3>
                      <p className="text-xs text-gray-400">Claimed: {new Date(claim.claimed_at).toLocaleDateString()}</p>
                      {claim.notes && (
                        <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 italic">
                          Staff Note: {claim.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                      {claim.status === "approved" ? (
                        <>
                          <span className="text-xs font-bold text-emerald-700">Eligible for your next reservation</span>
                          <Link href="/reserve" className="px-4 py-2 rounded-xl bg-[#3d0a14] text-gold text-xs font-bold hover:bg-[#5c1020] transition-colors">
                            Book &amp; Apply
                          </Link>
                        </>
                      ) : claim.status === "pending" ? (
                        <span className="text-xs text-amber-600 font-medium">Under admin review. You'll receive a notification upon approval.</span>
                      ) : claim.status === "used" ? (
                        <span className="text-xs text-gray-400 font-medium">Already applied to your reservation billing.</span>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">This promotion claim was not approved.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
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

                        {item.link_url && !item.link_text?.toLowerCase().includes("claim") && (
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

                      {/* Action buttons & Claim status */}
                      <div className="flex items-center gap-3 flex-wrap pt-4 border-t border-gray-100">
                        {(() => {
                          const existingClaim = userClaims.find((c) => c.promotion_id === item.id);
                          if (existingClaim) {
                            if (existingClaim.status === "pending") {
                              return (
                                <div className="px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-2">
                                  ⏳ Claim Pending Admin Review
                                </div>
                              );
                            }
                            if (existingClaim.status === "approved") {
                              return (
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-2">
                                    ✅ Promo Approved ({existingClaim.discount_percent}% Off)
                                  </span>
                                  <Link
                                    href={`/reserve?claim_id=${existingClaim.id}`}
                                    className="inline-flex items-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-gold px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                                  >
                                    Use Promo Voucher on Reservation <ArrowRight size={14} />
                                  </Link>
                                </div>
                              );
                            }
                            if (existingClaim.status === "used") {
                              return (
                                <span className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">
                                  ✓ Promo Redeemed on Booking
                                </span>
                              );
                            }
                            return (
                              <span className="px-5 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold">
                                Claim Not Approved
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => handleClaimPromo(item)}
                              disabled={claimingId === item.id}
                              className="inline-flex items-center gap-2 bg-[#3d0a14] hover:bg-[#5c1020] text-gold px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-[#3d0a14]/20 disabled:opacity-50 cursor-pointer"
                            >
                              <Tag size={15} />
                              {claimingId === item.id ? "Submitting Claim..." : "Claim This Promo Now"}
                            </button>
                          );
                        })()}

                        {item.link_url && !item.link_text?.toLowerCase().includes("claim") && (
                          <Link
                            href={item.link_url}
                            className="inline-flex items-center gap-2 border border-gray-200 hover:border-[#3d0a14] text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
                          >
                            {item.link_text || "View Details"}
                          </Link>
                        )}
                      </div>
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
