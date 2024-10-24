module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "eslint-config-prettier",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: [
    "dist",
    "analyzer/react/types",
    "framework-plugins/react/preview/types",
    "framework-plugins/vue2/preview/modules",
    "framework-plugins/vue3/preview/modules",
    "framework-plugins/*/tests/apps",
    "node_modules",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-var-requires": "off",
    "no-constant-condition": "off",
    "no-inner-declarations": "off",
    "no-console": "error",
    "prefer-const": "off",
  },
};
