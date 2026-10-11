/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#050507',
        // Cores do logo oficial
        brand: {
          DEFAULT: '#008F3F',
          dark: '#00702F',
          light: '#E9F6EE',
        },
        sun: {
          DEFAULT: '#F9B800',
          light: '#FFF7DB',
          text: '#8A5A00',
        },
        ink: '#0F1A14',
        surface: {
          DEFAULT: '#0A0C12',
          card: '#0F121B',
          highlight: '#161B26'
        },
        accent: {
          DEFAULT: '#22C55E',
          bright: '#4ADE80',
          lime: '#D4FF00',
          amber: '#FF7A00',
          gold: '#EAB308'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
