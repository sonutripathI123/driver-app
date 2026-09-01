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
        beige: {
          50: '#FAF8F5',
          100: '#F5EFE6',
          200: '#EAE0D0',
          300: '#DFCAA8',
          400: '#D5BC90',
          500: '#C2A16B',
          600: '#A4824C',
          700: '#7B6035',
          800: '#534023',
          900: '#2E2211',
        },
        luxury: {
          bg: "#070A0F",
          sidebar: "#0A0E15",
          surface: "#0F141E",
          card: "#121824",
          cardHover: "#182030",
          border: "#1E2738",
          borderLight: "#2B374E",
          beige: "#DFCAA8",
          beigeLight: "#FAF8F5",
          beigeDark: "#C2A16B",
          textMain: "#FFFFFF",
          textMuted: "#94A3B8"
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'beige-glow': '0 0 25px -5px rgba(223, 202, 168, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
