/** @type {import('tailwindcss').Config}
 *  Light-mode rebrand: white background, red titles, black body, gold accents.
 *  Token map kept the same name space so existing class usage flips palette
 *  without page-level rewrites.
 *   ink-*  → white / bone / warm gray scales (surfaces + borders + muted)
 *   bone-* → black / dark gray scales (text)
 *   crimson-* → titles, primary actions
 *   gold-*    → accents, eyebrows, hover state
 */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        // Surfaces (was dark) → now light
        ink: {
          950: "#ffffff", // page bg deepest
          900: "#ffffff", // page bg
          800: "#faf7f0", // panel bg (warm bone)
          700: "#f3ecdc", // raised
          600: "#e5dcc4", // border default
          500: "#a89e8c", // muted text / icons
        },
        // Text (was light) → now dark
        bone: {
          100: "#0a0a0a", // primary text (was bright)
          200: "#1a1a1a",
          300: "#3d3d3d", // secondary text
        },
        // Kell Commercial brand red (matched to the logo wordmark).
        crimson: {
          500: "#c0392f",
          600: "#a8201a", // primary — logo red
          700: "#8c1a15",
          800: "#6f1410",
        },
        gold: {
          400: "#d4b773",
          500: "#c9a961",
          600: "#a98a3f",
        },
      },
      fontFamily: {
        display: ["'Oswald'", "Impact", "Arial Black", "sans-serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      letterSpacing: { hero: "0.2em", brand: "0.35em" },
      boxShadow: {
        glow: "0 0 0 1px rgba(168,32,26,0.15), 0 24px 60px -28px rgba(168,32,26,0.30)",
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
