module.exports = {
  // mode: "jit",
  content: [
    "/Users/fwouts/dev/hungry/index.html",
    "/Users/fwouts/dev/hungry/{design,pages,screens}/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {
      filter: ["hover"],
      brightness: ["hover"],
    },
  },
  plugins: [],
};
