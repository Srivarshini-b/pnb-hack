/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0e17',
        panel: '#111827',
        border: '#1f2937',
        primary: '#3b82f6',
        secondary: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        textMain: '#f3f4f6',
        textMuted: '#9ca3af'
      },
      backgroundImage: {
        'glow-gradient': 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
      }
    },
  },
  plugins: [],
}
