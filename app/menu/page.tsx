"use client";
import React, from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function MenuPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 relative overflow-hidden py-32 px-6">
        {/* Background neon effect simulating the red light streaks */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[20%] w-[40vw] h-[120vh] bg-red-600 rounded-full blur-[120px] transform -rotate-12 mix-blend-screen" />
          <div className="absolute top-[20%] right-[10%] w-[30vw] h-[80vh] bg-red-700 rounded-full blur-[150px] transform rotate-45 mix-blend-screen" />
          <div className="absolute bottom-[-10%] left-[40%] w-[50vw] h-[50vh] bg-orange-600 rounded-full blur-[140px] mix-blend-screen" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          
          {/* Mock Logo from the image */}
          <div className="mb-8 relative flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-2 border-pink-500 flex items-center justify-center relative">
              <div className="w-20 h-20 rounded-full border-2 border-purple-500 flex items-center justify-center relative shadow-[0_0_15px_rgba(236,72,153,0.5)]">
                <span className="text-3xl">🍽️</span>
              </div>
            </div>
            <div className="absolute -right-24 text-left leading-tight">
              <span className="text-green-400 font-bold text-xl italic" style={{ fontFamily: "'Playfair Display', serif" }}>JBenz</span><br/>
              <span className="text-blue-500 font-bold text-lg italic" style={{ fontFamily: "'Playfair Display', serif" }}>Bistro</span>
            </div>
            <span className="absolute -bottom-4 text-pink-500 text-[10px] uppercase font-bold tracking-widest">Chicken Menu</span>
          </div>

          <h1 
            className="text-5xl md:text-6xl text-yellow-400 mb-16 italic font-bold tracking-wider"
            style={{ fontFamily: "'Playfair Display', serif", textShadow: "0 0 10px rgba(250,204,21,0.5)" }}
          >
            MENU
          </h1>

          <div className="w-full space-y-12 pl-4 md:pl-12">
            {/* Beverages */}
            <section>
              <h2 className="text-3xl text-white mb-6 italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                Beverages
              </h2>
              <ul className="space-y-4 text-lg md:text-xl text-yellow-50/90 font-light tracking-wide pl-4">
                <li className="flex gap-2">Softdrinks - 20 / 1.5L - 80</li>
                <li className="flex gap-2">Water 500ml - 15/1L - 25</li>
                <li className="flex gap-2">Tanduay Select - 150</li>
                <li className="flex gap-2">Emperador Light - 150</li>
              </ul>
            </section>

            {/* Pulutan */}
            <section>
              <h2 className="text-3xl text-white mb-6 italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                Pulutan
              </h2>
              <ul className="space-y-4 text-lg md:text-xl text-yellow-50/90 font-light tracking-wide pl-4">
                <li className="flex gap-2">Pork Sisig - 80</li>
                <li className="flex gap-2">Kropik / Fries - 39</li>
                <li className="flex gap-2">Tempura - 40</li>
                <li className="flex gap-2">Lumpia Shanghai (3 pcs.) - 20</li>
                <li className="flex gap-2">Siomai (3 pcs.) - 25</li>
              </ul>
            </section>

            {/* Also Available */}
            <section>
              <h2 className="text-3xl text-white mb-6 italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                Also Available:
              </h2>
              <ul className="space-y-4 text-lg md:text-xl text-yellow-50/90 font-light tracking-wide pl-4">
                <li className="flex gap-2">Tuslob Buwa - 80</li>
                <li className="flex gap-2">Unli Chicken - 199</li>
                <li className="flex gap-2">Red Horse 1L - 140</li>
                <li className="flex gap-2">Red Horse 1L (jar) - 410</li>
                <li className="flex gap-2">Red Horse 500ml - 75</li>
                <li className="flex gap-2">Red Horse 500ml Set (5pcs) - 369</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
