const { build } = require("esbuild");

build({
  entryPoints: ["./src/main.ts", "./src/index.ts"],
  minify: false,
  bundle: true,
  outdir: "./dist",
  platform: "node",
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
