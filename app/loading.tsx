export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-16 px-4 transition-all duration-300">
      <div className="relative flex flex-col items-center">
        {/* Subtle glow */}
        <div className="absolute w-32 h-32 bg-[#c9a84c]/10 rounded-full blur-2xl animate-pulse" />

        {/* Brand */}
        <h2 className="font-playfair text-2xl md:text-3xl font-bold mb-5 relative z-10 tracking-wide text-[#3d0a14] select-none">
          Jbenz <span className="text-[#c9a84c]">Bistro</span>
        </h2>

        {/* Dual-ring loading spinner */}
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-[#3d0a14] border-r-[#c9a84c] animate-spin" />
          <div className="absolute w-2 h-2 rounded-full bg-[#c9a84c]" />
        </div>
        <p className="mt-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Loading experience...</p>
      </div>
    </div>
  );
}

