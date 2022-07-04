export default {
  entries: ["./src/index"],
  rollup: {
    emitCJS: true,
  },
  externals: ["vite"],
  declaration: true,
  clean: true,
};
