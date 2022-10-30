export default {
  entries: ["./src/index"],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  declaration: true,
  clean: true,
};
