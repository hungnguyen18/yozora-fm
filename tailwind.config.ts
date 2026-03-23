import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          indigo: '#4F46E5',
        },
        secondary: {
          DEFAULT: '#F59E0B',
          gold: '#F59E0B',
        },
        accent: {
          DEFAULT: '#F97066',
          coral: '#F97066',
        },
        'deep-space': '#0A0B1A',
        midnight: '#141529',
        'soft-white': '#E8E8F0',
        'muted-lavender': '#9B9BB4',
        'deep-purple': '#7C3AED',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
