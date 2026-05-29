/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg0:       '#080A0E',
        bg1:       '#0D1117',
        bg2:       '#13181F',
        bg3:       '#1A2130',
        bg4:       '#1E2A3A',
        accent:    '#3B82F6',
        accentL:   '#60A5FA',
        accentD:   '#1D4ED8',
        online:    '#10B981',
        sent:      '#1D4ED8',
        danger:    '#EF4444',
        warning:   '#F59E0B',
        textP:     '#F0F4FF',
        textS:     '#8B97B0',
        textT:     '#4A5568',
        border1:   'rgba(255,255,255,0.06)',
        border2:   'rgba(255,255,255,0.10)',
        surface1:  'rgba(255,255,255,0.04)',
        surface2:  'rgba(255,255,255,0.07)',
        surface3:  'rgba(255,255,255,0.10)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
