import * as fs from "fs";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import webpack from "webpack";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { version } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf8")
);
if (!version) {
  throw new Error("Unable to detect version from package.json");
}

/** @type {import("webpack").Configuration} */
export default {
  entry: "./src/index.ts",
  mode: process.env["NODE_ENV"] || "production",
  target: "node",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: {
          loader: "ts-loader",
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@previewjs/core": path.join(__dirname, "../../core"),
      "@previewjs/loader": path.join(__dirname, "../../loader"),
    },
  },
  externals: {
    vscode: "commonjs2 vscode",
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify("@previewjs/pro"),
      ...(process.env["PREVIEWJS_DEV"] === "1"
        ? {
            "process.env.PREVIEWJS_MODULES_DIR": JSON.stringify(
              path.join(__dirname, "dev")
            ),
          }
        : {
            "process.env.PREVIEWJS_PACKAGE_VERSION": JSON.stringify("1.2.0"),
          }),
    }),
  ],
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "module",
    },
    chunkFormat: "module",
  },
  experiments: {
    outputModule: true,
  },
  optimization: {
    minimize: false,
  },
};
