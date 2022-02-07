const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

const { version } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf8")
);
if (!version) {
  throw new Error("Unable to detect version from package.json");
}

/** @type {import("webpack").Configuration} */
module.exports = {
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
      "process.env.PREVIEWJS_PACKAGE_NAME": JSON.stringify("@previewjs/app"),
      ...(process.env["PREVIEWJS_DEV"] === "1"
        ? {
            "process.env.PREVIEWJS_MODULES_DIR": JSON.stringify(
              path.join(__dirname, "../..")
            ),
          }
        : {
            "process.env.PREVIEWJS_PACKAGE_VERSION": JSON.stringify("1.0.4"),
          }),
    }),
  ],
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
  },
  optimization: {
    minimize: false,
  },
};
