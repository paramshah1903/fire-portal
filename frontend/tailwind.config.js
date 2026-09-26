/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Dark mode is toggled by adding class="dark" on the html element
  // (see ThemeProvider). This lets the whole tree opt into `dark:` variants.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // UPL corporate orange scale. 500 (#F37021) is the primary
        // brand orange; darker steps are used for buttons and hovered
        // states, lighter for subtle backgrounds and hover surfaces.
        brand: {
          50: '#fff5ee',
          100: '#ffe8d4',
          200: '#ffd0a9',
          300: '#ffae72',
          400: '#ff8038',
          500: '#f37021',
          600: '#db5b0e',
          700: '#b4460e',
          800: '#8c3812',
          900: '#742f13',
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
