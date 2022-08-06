const { build } = require("esbuild");

build({
  entryPoints: ["./src/index.ts"],
  minify: false,
  bundle: true,
  outdir: "./dist",
  external: ["fsevents", "vite"],
  platform: "node",
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
