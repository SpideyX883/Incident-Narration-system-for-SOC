/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sybil: {
          bg: 'rgb(var(--bg) / <alpha-value>)',
          surface: 'rgb(var(--surface) / <alpha-value>)',
          surface2: 'rgb(var(--surface2) / <alpha-value>)',
          surface3: 'rgb(var(--surface3) / <alpha-value>)',
          border: 'rgb(var(--border) / <alpha-value>)',
          border2: 'rgb(var(--border2) / <alpha-value>)',
          accent: 'rgb(var(--accent) / <alpha-value>)',
          purple: 'rgb(var(--accent2) / <alpha-value>)',
          green: 'rgb(var(--accent3) / <alpha-value>)',
          amber: 'rgb(var(--accent4) / <alpha-value>)',
          red: 'rgb(var(--accent5) / <alpha-value>)',
          text: 'rgb(var(--text) / <alpha-value>)',
          text2: 'rgb(var(--text2) / <alpha-value>)',
          text3: 'rgb(var(--text3) / <alpha-value>)',
        }
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0,229,255,0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0,229,255,0.4)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
