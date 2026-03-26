/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bard: {
          950: "#0a0812",
          900: "#110e1d",
          850: "#18132a",
          800: "#1f1836",
          700: "#2d2150",
          600: "#3d2d6b",
          500: "#5a3f9e",
          400: "#7b5fc4",
          300: "#9d83d9",
          200: "#c4b1eb",
          100: "#e6ddf7",
        },
        gold: {
          500: "#d4a843",
          400: "#e5c36a",
          300: "#f0d98f",
          200: "#f7ebc0",
        },
        ember: {
          500: "#c75c2e",
          400: "#e8793f",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        "glow-gold": "0 0 24px -4px rgba(212, 168, 67, 0.35)",
        "glow-bard": "0 0 24px -4px rgba(123, 95, 196, 0.35)",
      },
      animation: {
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
