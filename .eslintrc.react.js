const base = require("./.eslintrc");

module.exports = {
  ...base,
  extends: [...base.extends, "plugin:react/recommended"],
  plugins: [...base.plugins, "react"],
  settings: {
    ...base.settings,
    react: {
      version: "18",
    },
  },
};
