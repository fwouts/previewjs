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
  external: ["vscode"],
  platform: "node",
  define: {
    "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify("@previewjs/app"),
    ...(process.env.PREVIEWJS_DEV === "1"
      ? {
          "process.env.PREVIEWJS_MODULES_DIR": JSON.stringify(
            path.join(__dirname, "dev")
          ),
        }
      : {
          "process.env.PREVIEWJS_PACKAGE_VERSION": JSON.stringify("1.2.0"),
        }),
  },
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
