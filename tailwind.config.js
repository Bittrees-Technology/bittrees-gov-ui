/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      newtimesroman: ["Tinos", "serif"],
    },
    extend: {},
  }, 
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["cupcake"],
  },
}
