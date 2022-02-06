const path = require("path");

module.exports = {
  entry: {
    "is-installed": "./src/is-installed.ts",
    install: "./src/install.ts",
    "run-server": "./src/run-server.ts",
  },
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
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
  },
  optimization: {
    minimize: false,
    splitChunks: {
      chunks: "all",
    },
  },
};
