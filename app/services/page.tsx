"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const services = [
  {
    title: "Fine Dining",
    tagline: "Award-Winning Cuisine",
    description:
      "Indulge in a culinary journey crafted by our award-winning chefs. We source only the freshest local and seasonal ingredients, transforming them into dishes that are as beautiful to look at as they are to eat. From intimate dinners to celebratory feasts, every plate is a masterpiece.",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80",
    icon: "🍽️",
    features: [
      "Seasonal menu updated monthly",
      "Private dining rooms",
      "Sommelier-curated wine list",
      "Vegan & dietary options",
    ],
    color: "from-[#3d0a14] to-[#6b1020]",
  },
  {
    title: "Karaoke Rooms",
    tagline: "Premium Private Karaoke",
    description:
      "Sing your heart out in our fully soundproofed, privately-booked karaoke suites. With an expansive library of 50,000+ songs in multiple languages, top-of-the-line sound systems, and mood lighting you can customize, every session feels like a concert.",
    image:
      "https://s3-eu-west-1.amazonaws.com/prod-ecs-service-web-blog-media/2026/02/The-Mid-Century-Mode..._imresizer.jpg",
    icon: "🎤",
    features: [
      "50,000+ songs library",
      "Customizable mood lighting",
      "Complimentary welcome drinks",
      "Rooms for 4–20 guests",
    ],
    color: "from-[#1a0530] to-[#3d0a14]",
  },
  {
    title: "Billiard Tables",
    tagline: "Elegant Sport & Leisure",
    description:
      "Challenge friends or sharpen your skills on our premium Brunswick billiard tables, set in a sleek, lounge-style atmosphere. Whether you're a seasoned player or a first-timer, our space elevates the game with ambient lighting, craft cocktails, and tournament-grade equipment.",
    image:
      "https://www.manilabilliards.com/cdn/shop/files/photo_2024-08-03_01-05-56_1080x.jpg?v=1738293895",
    icon: "🎱",
    features: [
      "Tournament-grade tables",
      "Cue rental available",
      "Cocktail service at table",
      "Hourly & package rates",
    ],
    color: "from-[#0a2d1a] to-[#3d0a14]",
  },
  {
    title: "Event Hosting",
    tagline: "Private Events & Celebrations",
    description:
      "Make your special occasion truly unforgettable. Jbenz Bistro offers bespoke event packages for birthdays, corporate gatherings, anniversaries, and more. Our dedicated events team will work with you from the first consultation to the final toast.",
    image:
      "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80",
    icon: "🥂",
    features: [
      "Dedicated event coordinator",
      "Custom catering menus",
      "AV & sound equipment",
      "Capacity up to 150 guests",
    ],
    color: "from-[#2d1a00] to-[#3d0a14]",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Banner */}
      <div
        className="relative pt-[68px] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.93)] via-[rgba(107,16,32,0.85)] to-[rgba(30,5,10,0.95)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
          <p className="text-[0.78rem] tracking-[0.2em] uppercase text-gold font-semibold mb-3">
            What We Offer
          </p>
          <h1 className="font-playfair text-[clamp(2.4rem,5vw,3.8rem)] font-bold text-white leading-[1.15] mb-5">
            Our Services
          </h1>
          <p className="text-white/70 text-base max-w-[520px] mx-auto leading-[1.8]">
            Four world-class experiences under one roof — curated for those who
            demand the extraordinary.
          </p>
        </div>
      </div>

      {/* Services List */}
      <div className="max-w-[1160px] mx-auto px-6 py-20 space-y-24">
        {services.map((s, i) => (
          <article
            key={s.title}
            className={`flex flex-col ${
              i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
            } gap-12 items-center`}
          >
            {/* Image */}
            <div className="w-full lg:w-1/2 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(61,10,20,0.15)] flex-shrink-0 group">
              <div className="relative h-[340px] overflow-hidden">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${s.color} opacity-40`}
                />
                <div className="absolute top-5 left-5 w-12 h-12 rounded-full bg-[rgba(61,10,20,0.8)] backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg">
                  {s.icon}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="w-full lg:w-1/2">
              <p className="text-[0.75rem] tracking-[0.18em] uppercase text-gold font-semibold mb-2">
                {s.tagline}
              </p>
              <h2 className="font-playfair text-[clamp(1.9rem,3vw,2.6rem)] font-bold text-[#3d0a14] mb-4">
                {s.title}
              </h2>
              <p className="text-gray-600 text-base leading-[1.8] mb-7">
                {s.description}
              </p>

              {/* Feature list */}
              <ul className="space-y-2.5 mb-8">
                {s.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-sm text-gray-700"
                  >
                    <span className="w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#c9a84c"
                        strokeWidth="2.5"
                        width="11"
                        height="11"
                      >
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
                Reserve — {s.title} →
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="bg-[#3d0a14] py-20 px-6 text-center">
        <p className="text-[0.78rem] tracking-[0.18em] uppercase text-gold font-semibold mb-3">
          Ready to Experience It?
        </p>
        <h2 className="font-playfair text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-white mb-5">
          Book Your Table or Room Today
        </h2>
        <p className="text-white/65 text-base max-w-[440px] mx-auto mb-9 leading-[1.8]">
          Seats and private rooms fill up fast. Secure your experience now and
          step into a world of refined luxury.
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
