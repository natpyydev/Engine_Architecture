/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        engine: {
          900: '#07090e',
          850: '#0d1117',
          800: '#141a24',
          700: '#1e2636',
          600: '#2b364c',
          blue: '#0ea5e9',
          amber: '#f59e0b',
          fire: '#ef4444',
          spark: '#818cf8',
          metal: '#94a3b8'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
