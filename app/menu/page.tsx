"use client";
import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { getMenuImages } from "@/app/actions/menu";
import { UtensilsCrossed, Sparkles, ZoomIn, X } from "lucide-react";

interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string | null;
  available: boolean;
  sort_order: number;
  image_url?: string;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewItem(null);
    };
    if (previewItem) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [previewItem]);

  useEffect(() => {
    async function fetchMenu() {
      try {
        const [itemsRes, imagesMap] = await Promise.all([
          supabase
            .from("menu_items")
            .select("*")
            .eq("available", true)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          getMenuImages(),
        ]);

        if (itemsRes.data) {
          const merged: MenuItem[] = itemsRes.data.map((item: any) => ({
            ...item,
            image_url: item.image_url || imagesMap[item.id] || "",
          }));
          setMenuItems(merged);
        }
      } catch (e) {
        console.error("Error loading menu:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, []);

  const groupedItems = menuItems.reduce((acc: Record<string, MenuItem[]>, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const predefinedCategories = ["Beverages", "Pulutan", "Also Available"];
  const allCategories = [
    ...predefinedCategories,
    ...Object.keys(groupedItems).filter((k) => !predefinedCategories.includes(k)),
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <Navbar />

      {/* Hero Banner */}
      <div
        className="relative pt-[68px] overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.93)] via-[rgba(107,16,32,0.85)] to-[rgba(30,5,10,0.95)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
          <p className="text-[0.78rem] tracking-[0.2em] uppercase font-semibold mb-3 flex items-center justify-center gap-2" style={{ color: "#c9a84c" }}>
            <Sparkles size={14} /> What We Serve <Sparkles size={14} />
          </p>
          <h1 className="text-[clamp(2.4rem,5vw,3.8rem)] font-bold text-white leading-[1.15] mb-5" style={{ fontFamily: "'Playfair Display', serif" }}>
            Our Curated Menu
          </h1>
          <p className="text-white/70 text-base max-w-[540px] mx-auto leading-[1.8]">
            Enjoy our hand-crafted cocktails, chilled beverages, and delectable Filipino pulutan while you dine, sing in our VIP suites, or play billiards.
          </p>
        </div>
      </div>

      <main className="flex-1 py-14 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        {/* Category Filter */}
        {!loading && menuItems.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2.5 mb-12">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all duration-200 shadow-sm ${
                activeCategory === "All"
                  ? "bg-[#3d0a14] text-white border-[#3d0a14] shadow-md shadow-red-950/20"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#3d0a14] hover:text-[#3d0a14]"
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {allCategories
              .filter((cat) => groupedItems[cat] && groupedItems[cat].length > 0)
              .map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all duration-200 shadow-sm ${
                    activeCategory === cat
                      ? "bg-[#3d0a14] text-white border-[#3d0a14] shadow-md shadow-red-950/20"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#3d0a14] hover:text-[#3d0a14]"
                  }`}
                >
                  {cat} ({groupedItems[cat].length})
                </button>
              ))}
          </div>
        )}

        <div className="space-y-16">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-44 bg-gray-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm max-w-md mx-auto">
              <UtensilsCrossed size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700">No menu items available right now.</p>
              <p className="text-xs text-gray-400 mt-1">Please check back soon or ask our friendly staff.</p>
            </div>
          ) : (
            allCategories
              .filter((category) => activeCategory === "All" || activeCategory === category)
              .map((category) => {
                const items = groupedItems[category];
                if (!items || items.length === 0) return null;
                return (
                  <section key={category} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <h2
                        className="text-2xl font-bold text-[#3d0a14]"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {category}
                      </h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
                      <span className="text-xs text-gray-400 font-semibold">{items.length} dishes</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="group bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-xl hover:border-gold/30 transition-all duration-300 flex items-center gap-4 sm:gap-5 relative overflow-hidden"
                        >
                          {/* Item Image - Bigger & Clickable */}
                          <div
                            onClick={() => {
                              if (item.image_url) setPreviewItem(item);
                            }}
                            className={`w-28 h-28 sm:w-36 sm:h-36 md:w-36 md:h-36 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-sm transition-all ${
                              item.image_url
                                ? "cursor-pointer group/img hover:shadow-md hover:ring-2 hover:ring-[#c9a84c]/50"
                                : ""
                            }`}
                            title={item.image_url ? `Click to enlarge photo of ${item.name}` : undefined}
                          >
                            {item.image_url ? (
                              <>
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-105 group-hover/img:scale-110 transition-transform duration-500"
                                  onError={(e) => {
                                    // Fallback to icon if broken link
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                  <div className="bg-black/60 text-white rounded-full p-2.5 backdrop-blur-sm shadow-md transform scale-90 group-hover/img:scale-100 transition-transform">
                                    <ZoomIn size={20} />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-[#3d0a14]/40">
                                <UtensilsCrossed size={32} />
                                <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Jbenz</span>
                              </div>
                            )}
                          </div>

                          {/* Item Info */}
                          <div className="flex-1 min-w-0 pr-1 flex flex-col justify-between self-stretch py-0.5">
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#3d0a14] transition-colors line-clamp-1">
                                  {item.name}
                                </h3>
                                <span className="text-base sm:text-lg font-extrabold text-[#3d0a14] flex-shrink-0">
                                  ₱{Number(item.price).toLocaleString()}
                                </span>
                              </div>

                              {item.description ? (
                                <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 leading-relaxed italic mb-2.5">
                                  {item.description}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-300 italic mb-2.5">Signature house recipe</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                                {category}
                              </span>
                              {item.image_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewItem(item)}
                                  className="text-[11px] text-[#3d0a14] hover:text-[#c9a84c] font-medium flex items-center gap-1 transition-colors"
                                >
                                  <ZoomIn size={12} /> Click to enlarge
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })
          )}
        </div>

        {/* Image Lightbox Modal */}
        {previewItem && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            onClick={() => setPreviewItem(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative max-w-2xl w-full bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setPreviewItem(null)}
                className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 shadow-lg"
                aria-label="Close image preview"
              >
                <X size={20} />
              </button>

              {/* High-res image display */}
              <div className="w-full bg-black/60 flex items-center justify-center p-3 min-h-[260px] max-h-[68vh] overflow-hidden">
                <img
                  src={previewItem.image_url}
                  alt={previewItem.name}
                  className="w-full h-full max-h-[65vh] object-contain rounded-xl shadow-md"
                />
              </div>

              {/* Details bar */}
              <div className="p-5 sm:p-6 bg-stone-900 border-t border-white/10 flex items-start sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#3d0a14] text-[#c9a84c] border border-[#c9a84c]/30">
                      {previewItem.category || "Menu Item"}
                    </span>
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-bold text-white tracking-wide truncate"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {previewItem.name}
                  </h3>
                  {previewItem.description ? (
                    <p className="text-xs sm:text-sm text-gray-300 mt-1 line-clamp-2 italic leading-relaxed">
                      {previewItem.description}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1 italic">Signature house recipe</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Price</span>
                  <span className="text-xl sm:text-2xl font-extrabold text-[#c9a84c]">
                    ₱{Number(previewItem.price).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-gray-400 text-xs mt-20 pt-8 border-t border-gray-200/60">
          <p className="italic">Menu prices are in Philippine Peso (₱) and inclusive of applicable government taxes.</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
