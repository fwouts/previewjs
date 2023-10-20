import { copyLoader } from "@previewjs/loader/setup";
import { build } from "esbuild";
import path from "path";
import url from "url";

try {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  await build({
    entryPoints: ["./src/main.ts", "./src/worker.ts"],
    minify: false,
    bundle: true,
    format: "esm",
    outdir: "./dist",
    platform: "node",
    target: "es2020",
    banner: {
      // https://github.com/evanw/esbuild/issues/1921
      js: `
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
var __dirname = url.fileURLToPath(new URL(".", import.meta.url));
`.trim(),
    },
    define: {
      "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify(
        process.env.PREVIEWJS_PACKAGE_NAME || "@previewjs/pro"
      ),
    },
  });
  await copyLoader(path.join(__dirname, "dist"), "esm");
} catch (err) {
  if (err.stderr) {
    process.stderr.write(err.stderr);
  } else {
    console.error(err);
  }
  process.exit(1);
}
