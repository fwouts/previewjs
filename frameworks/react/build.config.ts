export default {
  entries: ["./src/index"],
  declaration: true,
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
  externals: ["@previewjs/core"],
};
