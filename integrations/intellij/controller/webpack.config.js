const path = require("path");

module.exports = {
  entry: "./src/main.ts",
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
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
  },
  optimization: {
    minimize: false,
  },
};
