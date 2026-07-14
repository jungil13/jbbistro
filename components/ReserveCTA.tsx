export default function ReserveCTA() {
  return (
    <section
      id="reserve"
      className="relative py-24 px-8 text-center overflow-hidden bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1400&q=80')] bg-center bg-cover bg-fixed"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(61,10,20,0.92)] to-[rgba(107,16,32,0.88)]" />

      {/* Content */}
      <div className="relative z-10 max-w-[680px] mx-auto">
        <p className="text-[0.78rem] tracking-[0.18em] uppercase text-gold font-semibold mb-3">
          Limited Seats Available
        </p>
        <h2 className="font-playfair text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-white mb-4 leading-[1.2]">
          Ready to Reserve Your Experience?
        </h2>
        <p className="text-white/75 text-base leading-[1.7] max-w-[500px] mx-auto mb-9">
          Book your table, karaoke room, or billiard table now and step into a
          world of refined luxury.
        </p>
        <a
          href="#contact"
          className="inline-block bg-gold text-[#3d0a14] no-underline px-10 py-4 rounded font-bold text-[0.95rem] tracking-[0.05em] transition-all duration-200 shadow-[0_4px_18px_rgba(201,168,76,0.3)] hover:bg-[#e2c46a] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(201,168,76,0.45)]"
        >
          Make a Reservation
        </a>
      </div>
    </section>
  );
}
