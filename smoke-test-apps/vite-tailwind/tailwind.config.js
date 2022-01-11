module.exports = {
  mode: "jit",
  purge: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        nunito: ["Nunito", "sans-serif"],
        work: ["Work Sans", "sans-serif"],
      },
      animation: {
        flow: "flow 10s linear infinite",
      },
      keyframes: {
        flow: {
          "100%": { backgroundPosition: "200px 0" },
        },
      },
      backgroundImage: (theme) => ({
        "stripes-light": `repeating-linear-gradient(
          -55deg,
          ${theme("colors.pink.100")},
          ${theme("colors.pink.100")} 10px,
          ${theme("colors.pink.200")} 10px,
          ${theme("colors.pink.200")} 20px
        )`,
        "stripes-dark": `repeating-linear-gradient(
          -55deg,
          ${theme("colors.purple.800")},
          ${theme("colors.purple.800")} 10px,
          ${theme("colors.purple.900")} 10px,
          ${theme("colors.purple.900")} 20px
        )`,
      }),
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
