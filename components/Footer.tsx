const quickLinks = ["Home", "Services", "Reserve", "Contact"];
const ourServices = ["Fine Dining", "Karaoke Rooms", "Billiard Tables", "Event Hosting"];

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
              <li key={l}>
                <a
                  href={`#${l.toLowerCase()}`}
                  className="text-white/65 no-underline text-sm transition-colors duration-200 hover:text-gold"
                >
                  {l}
                </a>
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
              <li key={s}>
                <a
                  href="#services"
                  className="text-white/65 no-underline text-sm transition-colors duration-200 hover:text-gold"
                >
                  {s}
                </a>
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
              href="#"
              aria-label="Facebook"
              className="flex items-center justify-center w-9 h-9 rounded-full border border-white/20 text-white/70 no-underline transition-all duration-200 hover:border-gold hover:text-gold hover:bg-[rgba(201,168,76,0.1)]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            {/* Instagram */}
            <a
              href="#"
              aria-label="Instagram"
              className="flex items-center justify-center w-9 h-9 rounded-full border border-white/20 text-white/70 no-underline transition-all duration-200 hover:border-gold hover:text-gold hover:bg-[rgba(201,168,76,0.1)]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            {/* Twitter/X */}
            <a
              href="#"
              aria-label="Twitter/X"
              className="flex items-center justify-center w-9 h-9 rounded-full border border-white/20 text-white/70 no-underline transition-all duration-200 hover:border-gold hover:text-gold hover:bg-[rgba(201,168,76,0.1)]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-white/60">
            <p>📍 123 Bistro Lane, City</p>
            <p>📞 +63 912 345 6789</p>
            <p>✉️ hello@jbenzbistro.com</p>
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
