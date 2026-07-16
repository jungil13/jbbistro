"use client";
import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";

interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string | null;
  available: boolean;
  sort_order: number;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const supabase = createClient();

  useEffect(() => {
    async function fetchMenu() {
      const { data } = await supabase
        .from("menu_items")
        .select("*")
        .eq("available", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (data) setMenuItems(data);
      setLoading(false);
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
          <p className="text-[0.78rem] tracking-[0.2em] uppercase font-semibold mb-3" style={{ color: "#c9a84c" }}>What We Serve</p>
          <h1 className="text-[clamp(2.4rem,5vw,3.8rem)] font-bold text-white leading-[1.15] mb-5" style={{ fontFamily: "'Playfair Display', serif" }}>
            Our Menu
          </h1>
          <p className="text-white/70 text-base max-w-[520px] mx-auto leading-[1.8]">
            Enjoy our curated selection of beverages and pulutan while you dine, sing, or play.
          </p>
        </div>
      </div>

      <main className="flex-1 py-16 px-6 max-w-5xl mx-auto w-full">

        {/* Category Filter */}
        {(!loading && menuItems.length > 0) && (
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
                activeCategory === "All"
                  ? "bg-[#3d0a14] text-white border-[#3d0a14]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#3d0a14] hover:text-[#3d0a14]"
              }`}
            >
              All
            </button>
            {allCategories
              .filter((cat) => groupedItems[cat] && groupedItems[cat].length > 0)
              .map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
                    activeCategory === cat
                      ? "bg-[#3d0a14] text-white border-[#3d0a14]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-[#3d0a14] hover:text-[#3d0a14]"
                  }`}
                >
                  {cat}
                </button>
              ))}
          </div>
        )}

        <div className="space-y-14">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No menu items available.</div>
          ) : (
            allCategories
              .filter((category) => activeCategory === "All" || activeCategory === category)
              .map((category) => {
                const items = groupedItems[category];
                if (!items || items.length === 0) return null;
                return (
                  <section key={category}>
                    <div className="flex items-center gap-3 mb-6">
                      <h2
                        className="text-2xl font-bold text-[#3d0a14]"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {category}
                      </h2>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow duration-200"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <h3 className="text-base font-semibold text-gray-800">{item.name}</h3>
                              {item.description && (
                                <p className="text-sm text-gray-500 mt-1 leading-relaxed italic">{item.description}</p>
                              )}
                            </div>
                            <span className="text-base font-bold text-[#3d0a14] flex-shrink-0">
                              ₱{Number(item.price).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })
          )}
        </div>

        <p className="text-center text-gray-400 text-xs mt-16 italic">
          Menu prices are subject to change without prior notice.
        </p>
      </main>

      <Footer />
    </div>
  );
}
