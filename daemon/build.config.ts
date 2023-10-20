export default {
  entries: ["./src/client", "./src/worker", "./src/index"],
  rollup: {
    inlineDependencies: true,
    resolve: {
      browser: false,
    },
  },
  declaration: true,
  clean: true,
};
