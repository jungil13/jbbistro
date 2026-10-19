import Link from "next/link";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Menu", href: "/menu" },
  { label: "Reserve", href: "/reserve" },
  { label: "Contact", href: "/contact" },
];
const ourServices = [
  { label: "Fine Dining", href: "/services" },
  { label: "Karaoke Rooms", href: "/services" },
  { label: "Billiard Tables", href: "/services" },
  { label: "Event Hosting", href: "/services" },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#3d0a14] text-white/75">
      {/* Top grid */}
      <div className="max-w-[1160px] mx-auto px-8 pt-16 pb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr] gap-12">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="font-playfair text-[1.4rem] font-bold mb-4">
            <span className="text-white">Jbenz</span>
            <span className="text-gold"> Bistro</span>
          </div>
          <p className="text-sm leading-[1.7] text-white/60 max-w-[260px]">
            Experience the perfect blend of fine dining, entertainment, and
            luxury in an unforgettable atmosphere.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-inter text-[0.78rem] font-bold tracking-[0.14em] uppercase text-gold mb-4">
            Quick Links
          </h4>
          <ul className="list-none flex flex-col gap-2.5">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-white/65 no-underline text-sm transition-colors duration-200 hover:text-gold block"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Our Services */}
        <div>
          <h4 className="font-inter text-[0.78rem] font-bold tracking-[0.14em] uppercase text-gold mb-4">
            Our Services
          </h4>
          <ul className="list-none flex flex-col gap-2.5">
            {ourServices.map((s) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className="text-white/65 no-underline text-sm transition-colors duration-200 hover:text-gold block"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Connect */}
        <div>
          <h4 className="font-inter text-[0.78rem] font-bold tracking-[0.14em] uppercase text-gold mb-4">
            Connect With Us
          </h4>
          <div className="flex gap-3 mb-5">
            {/* Facebook */}
            <a
              href="https://www.facebook.com/jbenzbistro"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Jbenz Bistro on Facebook"
              className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 text-white/80 no-underline transition-all duration-200 hover:border-gold hover:text-gold hover:bg-[rgba(201,168,76,0.15)] shadow-xs"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="19" height="19">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-white/60">
            <p>📍 Beside Poblacion Barangay Hall, Suba, Poblacion, Liloan, Philippines, 6003</p>
            <p>📞 +63 9935343043</p>
            <p>📧 jbenzbistro@gmail.com</p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 max-w-[1160px] mx-auto px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <p>© {new Date().getFullYear()} Jbenz Bistro. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="text-white/40 no-underline transition-colors duration-200 hover:text-gold">Privacy Policy</a>
          <a href="#" className="text-white/40 no-underline transition-colors duration-200 hover:text-gold">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
