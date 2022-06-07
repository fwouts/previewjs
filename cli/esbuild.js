const path = require("path");
const { build } = require("esbuild");

build({
  entryPoints: ["./src/main.ts"],
  minify: false,
  bundle: true,
  outfile: "./dist/main.js",
  platform: "node",
  define: {
    "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify(
      process.env.PREVIEWJS_PACKAGE_NAME || "@previewjs/pro"
    ),
  },
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
