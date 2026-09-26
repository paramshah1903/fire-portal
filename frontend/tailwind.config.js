/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f6fb',
          100: '#e0eaf4',
          200: '#bdd1e6',
          300: '#8fb0d1',
          400: '#5c88b6',
          500: '#3b6b9c',
          600: '#2d5580',
          700: '#264569',
          800: '#213b58',
          900: '#1e324a',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
