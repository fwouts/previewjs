const path = require("path");
const { build } = require("esbuild");

build({
  entryPoints: [
    "./src/install.ts",
    "./src/is-installed.ts",
    "./src/run-server.ts",
  ],
  minify: false,
  bundle: true,
  outdir: "./dist",
  platform: "node",
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
