export default {
  entries: ["./src/index"],
  rollup: {
    emitCJS: true,
  },
  externals: ["typescript"],
  declaration: true,
  clean: true,
};
