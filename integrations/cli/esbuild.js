import { build } from "esbuild";

build({
  entryPoints: ["./src/main.ts"],
  minify: false,
  bundle: true,
  format: "esm",
  outfile: "./dist/main.js",
  platform: "node",
  banner: {
    // https://github.com/evanw/esbuild/issues/1921
    js: `
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
`.trim(),
  },
  define: {
    "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify(
      process.env.PREVIEWJS_PACKAGE_NAME || "@previewjs/pro"
    ),
  },
}).catch((err) => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
