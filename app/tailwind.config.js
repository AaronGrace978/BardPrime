/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bard: {
          950: "rgb(var(--c-base-950) / <alpha-value>)",
          900: "rgb(var(--c-base-900) / <alpha-value>)",
          850: "rgb(var(--c-base-850) / <alpha-value>)",
          800: "rgb(var(--c-base-800) / <alpha-value>)",
          700: "rgb(var(--c-base-700) / <alpha-value>)",
          600: "rgb(var(--c-base-600) / <alpha-value>)",
          500: "rgb(var(--c-base-500) / <alpha-value>)",
          400: "rgb(var(--c-base-400) / <alpha-value>)",
          300: "rgb(var(--c-base-300) / <alpha-value>)",
          200: "rgb(var(--c-base-200) / <alpha-value>)",
          100: "rgb(var(--c-base-100) / <alpha-value>)",
        },
        gold: {
          500: "rgb(var(--c-accent-500) / <alpha-value>)",
          400: "rgb(var(--c-accent-400) / <alpha-value>)",
          300: "rgb(var(--c-accent-300) / <alpha-value>)",
          200: "rgb(var(--c-accent-200) / <alpha-value>)",
        },
        ember: {
          500: "rgb(var(--c-ember-500) / <alpha-value>)",
          400: "rgb(var(--c-ember-400) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        "glow-gold": "0 0 24px -4px rgb(var(--c-accent-500) / 0.35)",
        "glow-bard": "0 0 24px -4px rgb(var(--c-base-400) / 0.35)",
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
