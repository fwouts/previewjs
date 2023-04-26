export default {
  entries: ["./src/index"],
  rollup: {
    emitCJS: true,
  },
  declaration: true,
  clean: true,
  externals: ["@previewjs/core"],
};
