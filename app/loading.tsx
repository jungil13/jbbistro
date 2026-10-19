export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#3d0a14] flex flex-col items-center justify-center transition-all duration-300">
      <div className="relative flex flex-col items-center">
        {/* Glow effect */}
        <div className="absolute w-36 h-36 bg-[#c9a84c]/15 rounded-full blur-2xl animate-pulse" />

        {/* Brand */}
        <h1 className="font-playfair text-2xl md:text-3xl font-bold mb-6 relative z-10 tracking-wide text-white select-none">
          Jbenz <span className="text-[#c9a84c]">Bistro</span>
        </h1>

        {/* Bistro dual-ring loading spinner */}
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-3 border-white/10 border-t-[#c9a84c] border-r-[#c9a84c] animate-spin" />
          <div className="absolute w-2 h-2 rounded-full bg-[#c9a84c]" />
        </div>
      </div>
    </div>
  );
}
