export default {
  entries: ["./src/index"],
  externals: ["vite"],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
};
