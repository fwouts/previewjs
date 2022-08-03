export default {
  entries: ["./src/client", "./src/index"],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
    resolve: {
      browser: false
    },
    commonjs: {
      ignoreDynamicRequires: true,
    },
  },
  declaration: true,
  clean: true,
};
