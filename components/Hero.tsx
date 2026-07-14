import Link from "next/link";

export default function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center text-center overflow-hidden bg-[url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80')] bg-center bg-cover"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.82)] via-[rgba(107,16,32,0.70)] to-[rgba(30,5,10,0.88)]" />

      {/* Content */}
      <div className="relative z-10 max-w-[760px] px-8 animate-fadeUp">
        <p className="text-[0.8rem] tracking-[0.18em] uppercase text-gold mb-4 font-medium">
          An Unforgettable Experience
        </p>
        <h1 className="font-playfair text-[clamp(2.4rem,5vw,4rem)] font-bold text-white leading-[1.15] mb-5">
          Welcome to Jbenz Bistro
        </h1>
        <p className="text-base text-white/80 max-w-[520px] mx-auto mb-9 leading-[1.7]">
          Experience the perfect blend of fine dining, entertainment, and luxury
          in an unforgettable atmosphere.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/reserve"
            className="bg-gold text-[#3d0a14] no-underline px-9 py-3.5 rounded font-semibold text-sm tracking-wider transition-all duration-200 hover:bg-[#e2c46a] hover:-translate-y-0.5"
          >
            Reserve a Table
          </Link>
          <Link
            href="/services"
            className="border border-white/50 text-white no-underline px-9 py-3.5 rounded font-medium text-sm tracking-wider transition-all duration-200 hover:border-gold hover:bg-[rgba(201,168,76,0.12)] hover:text-gold"
          >
            Explore Services
          </Link>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <span className="block w-6 h-[38px] border-2 border-white/40 rounded-xl relative">
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-2 bg-gold rounded-sm animate-scrollBob" />
        </span>
      </div>
    </section>
  );
}
