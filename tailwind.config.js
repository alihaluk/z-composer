/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Tokens used by the UI components (Button, inputs).
      colors: {
        background: '#ffffff',
        input: '#d1d5db',
        ring: '#3b82f6',
        accent: { DEFAULT: '#f3f4f6', foreground: '#111827' },
      },
    },
  },
  plugins: [],
}
