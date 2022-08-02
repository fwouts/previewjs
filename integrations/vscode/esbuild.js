const path = require("path");
const { build } = require("esbuild");

build({
  entryPoints: ["./src/index.ts", "./src/server.ts"],
  minify: false,
  bundle: true,
  outdir: "./dist",
  external: ["vscode"],
  platform: "node",
  define: {
    "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify(
      process.env.PREVIEWJS_PACKAGE_NAME || "@previewjs/pro"
    ),
    ...(process.env.PREVIEWJS_DEV === "1" && {
      "process.env.PREVIEWJS_MODULES_DIR": JSON.stringify(
        path.join(__dirname, "..", "..", "dev-workspace")
      ),
    }),
  },
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
