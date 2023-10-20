export default {
  entries: ["./src/client", "./src/index"],
  rollup: {
    inlineDependencies: true,
    resolve: {
      browser: false,
    },
  },
  declaration: true,
  clean: true,
};
