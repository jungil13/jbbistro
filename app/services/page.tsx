"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Utensils, Mic2, Circle, Users, PhilippinePeso, UtensilsCrossed } from "lucide-react";

const STATIC_SERVICES = [
  {
    type: "dining",
    tagline: "Award-Winning Cuisine",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80",
    icon: "🍽️",
    features: ["Seasonal menu updated monthly", "Private dining rooms", "Sommelier-curated wine list", "Vegan & dietary options"],
    color: "from-[#3d0a14] to-[#6b1020]",
  },
  {
    type: "karaoke",
    tagline: "Premium Private Karaoke",
    image: "https://s3-eu-west-1.amazonaws.com/prod-ecs-service-web-blog-media/2026/02/The-Mid-Century-Mode..._imresizer.jpg",
    icon: "🎤",
    features: ["50,000+ songs library", "Customizable mood lighting", "Complimentary welcome drinks", "Rooms for 4–20 guests"],
    color: "from-[#1a0530] to-[#3d0a14]",
  },
  {
    type: "billiards",
    tagline: "Elegant Sport & Leisure",
    image: "https://www.manilabilliards.com/cdn/shop/files/photo_2024-08-03_01-05-56_1080x.jpg?v=1738293895",
    icon: "🎱",
    features: ["Tournament-grade tables", "Cue rental available", "Cocktail service at table", "Hourly & package rates"],
    color: "from-[#0a2d1a] to-[#3d0a14]",
  },
];

const typeLabels: Record<string, string> = {
  dining: "Fine Dining",
  karaoke: "Karaoke Rooms",
  billiards: "Billiard Tables",
};

const MENU_CATEGORIES = ["Beverages", "Pulutan", "Also Available"];

export default function ServicesPage() {
  const supabase = createClient();
  const [services, setServices] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingSvc, setLoadingSvc] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: svcs }, { data: menu }] = await Promise.all([
        supabase.from("services").select("*").eq("status", "available").order("type"),
        supabase.from("menu_items").select("*").eq("available", true).order("sort_order"),
      ]);
      if (svcs) setServices(svcs);
      setLoadingSvc(false);
      if (menu) setMenuItems(menu);
      setLoadingMenu(false);
    };
    fetchAll();
  }, []);

  // Merge DB services with static metadata, group one representative per type
  const serviceTypes = STATIC_SERVICES.map((meta) => {
    const dbItems = services.filter((s) => s.type === meta.type);
    const representative = dbItems[0]; // use first for display
    return { ...meta, dbItems, representative };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Banner */}
      <div
        className="relative pt-[68px] overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.93)] via-[rgba(107,16,32,0.85)] to-[rgba(30,5,10,0.95)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
          <p className="text-[0.78rem] tracking-[0.2em] uppercase text-gold font-semibold mb-3">What We Offer</p>
          <h1 className="font-playfair text-[clamp(2.4rem,5vw,3.8rem)] font-bold text-white leading-[1.15] mb-5">Our Services</h1>
          <p className="text-white/70 text-base max-w-[520px] mx-auto leading-[1.8]">
            Four world-class experiences under one roof — curated for those who demand the extraordinary.
          </p>
        </div>
      </div>

      {/* Services List */}
      <div className="max-w-[1160px] mx-auto px-6 py-20 space-y-24">
        {serviceTypes.map((s, i) => (
          <article
            key={s.type}
            className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 items-center`}
          >
            {/* Image */}
            <div className="w-full lg:w-1/2 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(61,10,20,0.15)] flex-shrink-0 group">
              <div className="relative h-[340px] overflow-hidden">
                <img src={s.image} alt={typeLabels[s.type]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                <div className={`absolute inset-0 bg-gradient-to-t ${s.color} opacity-40`} />
                <div className="absolute top-5 left-5 w-12 h-12 rounded-full bg-[rgba(61,10,20,0.8)] backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg">
                  {s.icon}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="w-full lg:w-1/2">
              <p className="text-[0.75rem] tracking-[0.18em] uppercase text-gold font-semibold mb-2">{s.tagline}</p>
              <h2 className="font-playfair text-[clamp(1.9rem,3vw,2.6rem)] font-bold text-[#3d0a14] mb-4">{typeLabels[s.type]}</h2>

              {/* Description from DB (first available service of this type) */}
              {loadingSvc ? (
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-7 w-3/4" />
              ) : s.representative?.description ? (
                <p className="text-gray-600 text-base leading-[1.8] mb-5">{s.representative.description}</p>
              ) : null}

              {/* Available rooms/tables */}
              {!loadingSvc && s.dbItems.length > 0 && (
                <div className="mb-6 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Available Options</p>
                  {s.dbItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                        <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-full">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Users size={12} /> {item.capacity} pax</span>
                        <span className="font-bold text-[#6b1020]">₱{item.hourly_rate}/hr</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Feature list */}
              <ul className="space-y-2.5 mb-8">
                {s.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2.5" width="11" height="11">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/reserve"
                className="inline-block bg-[#3d0a14] text-gold no-underline px-8 py-3.5 rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-[#6b1020] hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(61,10,20,0.2)]"
              >
                Reserve — {typeLabels[s.type]} →
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* ─── MENU SECTION ─── */}
      <div className="bg-[#1a0a0e] py-20 px-6">
        <div className="max-w-[860px] mx-auto">
          <div className="text-center mb-14">
            <p className="text-[0.78rem] tracking-[0.2em] uppercase text-gold font-semibold mb-3">What We Serve</p>
            <h2 className="font-playfair text-[clamp(2rem,4vw,3rem)] font-bold text-white mb-4">Our Menu</h2>
            <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
              Enjoy our curated selection of beverages and pulutan while you dine, sing, or play.
            </p>
          </div>

          {loadingMenu ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {MENU_CATEGORIES.map((cat) => {
                const items = menuItems.filter((m) => m.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-5">
                      <UtensilsCrossed size={15} className="text-gold" />
                      <h3 className="font-playfair text-lg font-bold text-gold italic">{cat}</h3>
                    </div>
                    <ul className="space-y-3">
                      {items.map((item) => (
                        <li key={item.id} className="flex justify-between items-baseline gap-2 text-sm">
                          <span className="text-white/80">{item.name}</span>
                          <span className="text-gold font-bold flex-shrink-0">₱{Number(item.price).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-white/30 text-xs mt-8 italic">
            Menu prices are subject to change without prior notice.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-[#3d0a14] py-20 px-6 text-center">
        <p className="text-[0.78rem] tracking-[0.18em] uppercase text-gold font-semibold mb-3">Ready to Experience It?</p>
        <h2 className="font-playfair text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-white mb-5">Book Your Table or Room Today</h2>
        <p className="text-white/65 text-base max-w-[440px] mx-auto mb-9 leading-[1.8]">
          Seats and private rooms fill up fast. Secure your experience now and step into a world of refined luxury.
        </p>
        <Link
          href="/reserve"
          className="inline-block bg-gold text-[#3d0a14] no-underline px-10 py-4 rounded-lg font-bold text-sm tracking-wide transition-all duration-200 hover:bg-[#e2c46a] hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(201,168,76,0.3)]"
        >
          Make a Reservation
        </Link>
      </div>

      <Footer />
    </div>
  );
}
