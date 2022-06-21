export default {
  entries: ["./src/index"],
  rollup: {
    emitCJS: true,
  },
  externals: ["@previewjs/api", "@previewjs/core"],
  clean: true,
};
