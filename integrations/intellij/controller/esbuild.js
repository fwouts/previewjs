const { build } = require("esbuild");

build({
  entryPoints: ["./src/main.ts"],
  minify: false,
  bundle: true,
  outfile: "./dist/main.js",
  platform: "node",
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
