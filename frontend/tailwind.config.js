/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        luxury: {
          bg: "#0A0E1A",
          sidebar: "#0D1322",
          surface: "#121A2D",
          card: "#162036",
          cardHover: "#1D2A47",
          border: "#1F2E4D",
          borderLight: "#2A3D66",
          gold: "#D4AF37",
          goldLight: "#F5E096",
          goldDark: "#997A15",
          amber: "#F59E0B",
          cyan: "#06B6D4",
          cyanGlow: "#22D3EE",
          emerald: "#10B981",
          rose: "#F43F5E",
          textMain: "#F8FAFC",
          textMuted: "#94A3B8"
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'luxury-glow': '0 0 25px -5px rgba(212, 175, 55, 0.25)',
        'cyan-glow': '0 0 25px -5px rgba(6, 182, 212, 0.3)',
        'emerald-glow': '0 0 25px -5px rgba(16, 185, 129, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
