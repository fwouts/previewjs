import { build } from "esbuild";

build({
  entryPoints: ["./src/main.ts"],
  minify: false,
  bundle: true,
  format: "esm",
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
