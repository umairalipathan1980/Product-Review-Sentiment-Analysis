import animatePlugin from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'serif']
      },
      colors: {
        'dashboard-positive': '#0f9f78',
        'dashboard-negative': '#d45a53',
        'dashboard-brand': '#132033',
        'dashboard-copper': '#b7791f',
        'dashboard-sand': '#f4efe6',
        'dashboard-neutral': '#64748b'
      },
      boxShadow: {
        panel: '0 24px 70px rgba(15, 23, 42, 0.12)',
        float: '0 18px 40px rgba(15, 23, 42, 0.1)',
        glow: '0 0 35px rgba(183, 121, 31, 0.2)'
      }
    }
  },
  plugins: [animatePlugin]
}
