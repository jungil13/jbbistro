/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        burgundy: {
          dark: "#3d0a14",
          DEFAULT: "#6b1020",
          mid: "#8b1a2a",
        },
        gold: {
          DEFAULT: "#c9a84c",
          light: "#e2c46a",
        },
        cream: "#fdf6ec",
      },
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        inter: ["Inter", "sans-serif"],
      },
      animation: {
        fadeUp: "fadeUp 0.9s ease both",
        scrollBob: "scrollBob 1.8s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(28px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scrollBob: {
          "0%, 100%": { opacity: "1", transform: "translateX(-50%) translateY(0)" },
          "50%": { opacity: "0.3", transform: "translateX(-50%) translateY(10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;