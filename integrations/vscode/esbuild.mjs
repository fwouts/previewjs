import { copyLoader } from "@previewjs/loader/setup";
import { build } from "esbuild";
import path from "path";
import process from "process";
import url from "url";

try {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  await build({
    entryPoints: ["./src/index.ts", "./src/daemon.ts"],
    minify: false,
    bundle: true,
    format: "cjs", // VS Code does not support ESM extensions
    outdir: "./dist",
    external: ["vscode"],
    platform: "node",
    define: {
      "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify(
        process.env.PREVIEWJS_PACKAGE_NAME || "@previewjs/pro"
      ),
      ...(process.env.PREVIEWJS_PORT && {
        "process.env.PREVIEWJS_PORT": JSON.stringify(
          process.env.PREVIEWJS_PORT
        ),
      }),
      ...(process.env.PREVIEWJS_MODULES_DIR && {
        "process.env.PREVIEWJS_MODULES_DIR": JSON.stringify(
          path.join(__dirname, process.env.PREVIEWJS_MODULES_DIR)
        ),
      }),
    },
  });
  await copyLoader(path.join(__dirname, "dist"), "cjs");
} catch (err) {
  if (err.stderr) {
    process.stderr.write(err.stderr);
  } else {
    console.error(err);
  }
  process.exit(1);
}
