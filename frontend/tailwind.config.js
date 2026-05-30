/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#070707", 900: "#0a0a0a", 800: "#141414", 700: "#1f1f1f", 600: "#2a2a2a", 500: "#3a3a3a" },
        crimson: { 600: "#b91c1c", 700: "#991616", 800: "#7f1010", 500: "#c92828" },
        gold: { 400: "#d4b773", 500: "#c9a961", 600: "#b09453" },
        bone: { 100: "#f5f1ea", 200: "#e6dccb", 300: "#cfc1a8" },
      },
      fontFamily: {
        display: ["'Oswald'", "Impact", "Arial Black", "sans-serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      letterSpacing: { hero: "0.2em", brand: "0.35em" },
      boxShadow: {
        glow: "0 0 0 1px rgba(185,28,28,0.35), 0 24px 60px -25px rgba(185,28,28,0.45)",
      },
    },
  },
  plugins: [],
};
