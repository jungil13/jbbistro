"use client";
import { useEffect, useState } from "react";

export default function Loading() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#3d0a14] flex flex-col items-center justify-center transition-all duration-500">
      <div className="relative flex flex-col items-center">
        {/* Glow effect behind */}
        <div className="absolute w-32 h-32 bg-[#c9a84c]/20 rounded-full blur-2xl animate-pulse" />

        {/* Animated Brand */}
        <h1 className="font-playfair text-3xl md:text-4xl font-bold mb-8 relative z-10 tracking-wide text-white select-none">
          Jbenz <span className="text-[#c9a84c]">Bistro</span>
        </h1>

        {/* Premium loader ring */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#c9a84c] border-r-[#c9a84c] animate-spin" />
          <span className="text-[10px] font-mono text-[#c9a84c] font-bold mt-1">
            {percent}%
          </span>
        </div>
      </div>
    </div>
  );
}
