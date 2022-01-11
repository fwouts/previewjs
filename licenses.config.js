module.exports = {
  isValidLicense: (license) => {
    const valid = new RegExp(
      "\\b(mit|apache\\b.*2|bsd|0bsd|isc|unlicense|cc0-1.0|cc-by-3.0|cc-by-4.0|odc-by-1.0|python-2.0|wtfpl)\\b",
      "i"
    );
    return valid.test(license);
  },
  ignorePackages: [
    "@nuxt/design", // only used in Nuxt test app (not distributed)
    "axe-core", // only used for linting
    "glob-regex", // MIT according to https://github.com/aleclarson/glob-regex/blob/master/LICENSE
    "only", // MIT according to https://github.com/tj/node-only/blob/master/LICENSE
    "postcss-values-parser", // only used for Nuxt test app (not distributed)
    "require-like", // MIT according to https://github.com/felixge/node-require-like/blob/master/License
    "rework", // MIT according to https://github.com/reworkcss/rework/blob/master/package.json#L32
    "trim", // MIT according to https://github.com/Trott/trim/blob/main/package.json#L5
    "webpack-chain", // Indirect dependency of @vue/cli-service, only used in test app (not distributed)
  ],
};
