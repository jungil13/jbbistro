import { Utensils, Mic2, Circle } from "lucide-react";

const services = [
  {
    title: "Fine Dining",
    description:
      "Exquisite cuisine crafted by our award-winning chefs, using only the freshest local ingredients. Every plate is a work of art.",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
    icon: <Utensils size={32} className="text-[#3d0a14]" />,
  },
  {
    title: "Karaoke Rooms",
    description:
      "Fully private rooms with premium sound systems, brilliant song libraries, and complimentary snacks for an unforgettable night.",
    image:
      "https://s3-eu-west-1.amazonaws.com/prod-ecs-service-web-blog-media/2026/02/The-Mid-Century-Mode..._imresizer.jpg",
    icon: <Mic2 size={32} className="text-[#3d0a14]" />,
  },
  {
    title: "Billiard Tables",
    description:
      "Professional-grade billiard tables set in an elegant atmosphere — perfect for leisure and competition alike.",
    image:
      "https://www.manilabilliards.com/cdn/shop/files/photo_2024-08-03_01-05-56_1080x.jpg?v=1738293895",
    icon: <Circle size={32} className="text-[#3d0a14]" />,
  },
];

export default function Services() {
  return (
    <section id="services" className="py-24 px-8 bg-white">
      <div className="max-w-[1160px] mx-auto text-center">
        <p className="text-[0.78rem] tracking-[0.18em] uppercase text-gold font-semibold mb-2">
          What We Offer
        </p>
        <h2 className="font-playfair text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold text-[#3d0a14] mb-3">
          Our Services
        </h2>
        <p className="text-[#4a4a4a] text-base max-w-[480px] mx-auto mb-14 leading-[1.7]">
          Indulge in world-class experiences curated for the discerning guest.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[480px] md:max-w-none mx-auto">
          {services.map((s) => (
            <article
              key={s.title}
              className="rounded-xl overflow-hidden bg-white shadow-[0_4px_24px_rgba(61,10,20,0.08)] text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(61,10,20,0.14)] group"
            >
              {/* Image */}
              <div className="relative h-[200px] overflow-hidden">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(61,10,20,0.4)]" />
              </div>

              {/* Body */}
              <div className="p-6 pb-7">
                <span className="block mb-4">{s.icon}</span>
                <h3 className="font-playfair text-xl font-bold text-[#3d0a14] mb-2">
                  {s.title}
                </h3>
                <p className="text-[#4a4a4a] text-sm leading-[1.7] mb-4">
                  {s.description}
                </p>
                <a
                  href="#reserve"
                  className="text-gold text-sm font-semibold no-underline tracking-wide inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-[#6b1020]"
                >
                  Learn more <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
