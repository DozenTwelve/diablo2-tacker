// tailwind.config.js
/* global module */
module.exports = {
  darkMode: 'class', // ✅ M 要大写！
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        gothic: ['"UnifrakturCook"', 'cursive'],
      },
    },
  },
  plugins: [],
}
