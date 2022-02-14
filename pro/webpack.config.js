const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    index: "./src/index.ts",
    "analyze-project-subprocess": "./src/actions/analyze-project/subprocess.ts",
  },
  mode: process.env["NODE_ENV"] || "production",
  target: "node",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            projectReferences: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /analyze-project.ts$/,
        loader: "string-replace-loader",
        options: {
          search: `"analyze-project", "subprocess"`,
          replace: `"analyze-project-subprocess.js"`,
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@previewjs/pro-api": path.resolve(__dirname, "../api/src"),
    },
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.APP_DIR_PATH": JSON.stringify("../client"),
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "../client/build",
          to: "client",
          filter: (path) => !path.includes(".gitignore"),
        },
        {
          from: "release/package.json",
          to: "package.json",
        },
      ],
    }),
  ],
  externals: {
    "@previewjs/core": "commonjs2 @previewjs/core",
    "@previewjs/core/ts-helpers": "commonjs2 @previewjs/core/ts-helpers",
    "@previewjs/core/vfs": "commonjs2 @previewjs/core/vfs",
    "@previewjs/loader": "commonjs2 @previewjs/loader",
    "@previewjs/plugin-react": "commonjs2 @previewjs/plugin-react",
    "@previewjs/plugin-vue3": "commonjs2 @previewjs/plugin-vue3",
  },
  output: {
    filename: "lib/[name].js",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "commonjs2",
    },
  },
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },
};
