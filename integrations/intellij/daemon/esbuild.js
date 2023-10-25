import { copyLoader } from "@previewjs/loader/setup";
import { build } from "esbuild";
import { readFileSync } from "fs";
import path from "path";
import url from "url";

try {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  const gradlePropertiesContent = readFileSync(
    path.join(__dirname, "..", "gradle.properties"),
    "utf8"
  );
  const pluginVersion = gradlePropertiesContent.match(
    /pluginVersion *= *(.+)/
  )[1];
  if (!pluginVersion) {
    throw new Error(
      `Plugin version could not be extracted from gradle.properties`
    );
  }

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
      "process.env.PREVIEWJS_INTELLIJ_VERSION": JSON.stringify(pluginVersion),
      ...(process.env.PREVIEWJS_MODULES_DIR && {
        "process.env.PREVIEWJS_MODULES_DIR": JSON.stringify(
          path.join(__dirname, process.env.PREVIEWJS_MODULES_DIR)
        ),
      }),
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
