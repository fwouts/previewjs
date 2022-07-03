const base = require("./.eslintrc");

module.exports = {
  ...base,
  extends: [
    ...base.extends,
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  plugins: [...base.plugins, "react"],
  rules: {
    ...base.settings,
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
