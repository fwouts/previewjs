const base = require("./.eslintrc.cjs");

module.exports = {
  ...base,
  extends: [
    ...base.extends,
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  plugins: [...base.plugins, "react"],
  rules: {
    ...base.rules,
    "react/display-name": "off",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
  },
  settings: {
    ...base.settings,
    react: {
      version: "18",
    },
  },
};
