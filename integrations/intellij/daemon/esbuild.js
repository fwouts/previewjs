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
      "process.env.PREVIEWJS_INTELLIJ_VERSION": JSON.stringify(pluginVersion),
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
