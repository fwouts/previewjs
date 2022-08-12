const { build } = require("esbuild");
const { readFileSync } = require("fs");
const path = require("path");

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
    "process.env.PREVIEWJS_INTELLIJ_VERSION": JSON.stringify(pluginVersion),
  },
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
