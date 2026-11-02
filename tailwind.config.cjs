/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tarja: {
          isento: '#10b981',
          vermelha: '#ef4444',
          preta: '#18181b',
        },
      },
    },
  },
  plugins: [],
};
