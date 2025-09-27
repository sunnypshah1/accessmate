import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f6ff',
          100: '#d9e5ff',
          200: '#b0c8ff',
          300: '#86abff',
          400: '#5d8eff',
          500: '#3770ff',
          600: '#2357db',
          700: '#1a43ab',
          800: '#12307b',
          900: '#091c4c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
