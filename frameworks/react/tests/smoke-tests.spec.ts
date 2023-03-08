import { test } from "@playwright/test";
import { smokeTests } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

test.describe.parallel("smoke tests", () => {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  smokeTests({
    projectsDir: path.join(__dirname, "apps"),
    pluginFactory,
    componentIdsPerProject: {
      aliases: ["src/App.tsx:App"],
      "aliases-via-jsconfig": ["src/App.js:App"],
      "class-components-js": ["src/App.jsx:App"],
      "class-components-ts": ["src/App.tsx:App"],
      "cra-css-modules": ["src/App.tsx:App"],
      "cra-css-modules-no-suffix": ["src/App.tsx:App"],
      "cra-custom-svgr": ["src/App.tsx:App"],
      "cra-emotion": ["src/App.tsx:App"],
      "cra-emotion-react16": ["src/App.tsx:App"],
      "cra-js": ["src/App.js:App"],
      "cra-jsx": ["src/App.jsx:App"],
      "cra-less": ["src/App.tsx:App"],
      "cra-react-router": ["src/App.tsx:App"],
      "cra-sass": ["src/App.tsx:App"],
      "cra-sass-modules": ["src/App.tsx:App"],
      "cra-sass-modules-no-suffix": ["src/App.tsx:App"],
      "cra-storybook-js": ["src/stories/Button.stories.jsx:Primary"],
      "cra-storybook-ts": ["src/stories/Button.stories.tsx:Primary"],
      "cra-styled-components": ["src/App.tsx:App"],
      "cra-suspense": ["src/App.jsx:App"],
      "cra-svgr": ["src/App.tsx:App"],
      "cra-tailwind": ["src/App.tsx:App"],
      "cra-tailwind-postcsscjs": ["src/App.tsx:App"],
      "cra-tailwind-postcssts": ["src/App.tsx:App"],
      "cra-ts": ["src/App.tsx:App"],
      "cra-ts-react16": ["src/App.tsx:App"],
      "cra-ts-react18": ["src/App.tsx:App"],
      "imported-types": ["src/App.tsx:App"],
      "material-ui": ["src/App.tsx:App"],
      "nextjs-11": ["pages/index.tsx:App"],
      "nextjs-12": ["pages/index.tsx:App"],
      "nextjs-13": ["pages/index.tsx:App"],
      "react-native-web-app": ["App.tsx:App"],
      "storybook-js": ["src/App.jsx:App"],
      "vite-tailwind": ["src/App.tsx:App"],
      "vite-ts-react-swc": ["src/App.tsx:App"],
      "vite-vanilla-extract": ["src/App.tsx:App"],
      "vite-with-svgr": ["src/App.tsx:App"],
      "vite-without-svgr": ["src/App.tsx:App"],
      "wrapper-custom": ["src/App.tsx:App"],
      "wrapper-default": ["src/App.tsx:App"],
    },
  });
});
