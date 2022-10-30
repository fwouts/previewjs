export default {
  entries: ["./src/index", "./src/main"],
  rollup: {
    emitCJS: true,
  },
  externals: ["vite"],
  declaration: true,
  clean: true,
};
