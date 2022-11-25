import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const smokeTestApp = (name: string) => path.join(__dirname, "apps", name);

test.describe("smoke tests", () => {
  for (const [appName, componentId] of [
    ["aliases", "src/App.tsx:App"],
    ["aliases-via-jsconfig", "src/App.js:App"],
    ["class-components-js", "src/App.jsx:App"],
    ["class-components-ts", "src/App.tsx:App"],
    ["cra-css-modules", "src/App.tsx:App"],
    ["cra-css-modules-no-suffix", "src/App.tsx:App"],
    ["cra-custom-svgr", "src/App.tsx:App"],
    ["cra-emotion", "src/App.tsx:App"],
    ["cra-emotion-react16", "src/App.tsx:App"],
    ["cra-js", "src/App.js:App"],
    ["cra-jsx", "src/App.jsx:App"],
    ["cra-less", "src/App.tsx:App"],
    ["cra-react-router", "src/App.tsx:App"],
    ["cra-sass", "src/App.tsx:App"],
    ["cra-sass-modules", "src/App.tsx:App"],
    ["cra-sass-modules-no-suffix", "src/App.tsx:App"],
    ["cra-styled-components", "src/App.tsx:App"],
    ["cra-suspense", "src/App.jsx:App"],
    ["cra-svgr", "src/App.tsx:App"],
    ["cra-tailwind", "src/App.tsx:App"],
    ["cra-tailwind-postcsscjs", "src/App.tsx:App"],
    ["cra-tailwind-postcssts", "src/App.tsx:App"],
    ["cra-ts", "src/App.tsx:App"],
    ["cra-ts-react16", "src/App.tsx:App"],
    ["cra-ts-react18", "src/App.tsx:App"],
    ["custom-preview", "src/App.tsx:App"],
    ["imported-types", "src/App.tsx:App"],
    ["material-ui", "src/App.tsx:App"],
    ["nextjs-11", "pages/index.tsx:App"],
    ["nextjs-12", "pages/index.tsx:App"],
    ["nextjs-13", "pages/index.tsx:App"],
    ["react-native-web-app", "App.tsx:App"],
    ["storybook-js", "src/App.jsx:App"],
    ["vite-tailwind", "src/App.tsx:App"],
    ["vite-vanilla-extract", "src/App.tsx:App"],
    ["vite-with-svgr", "src/App.tsx:App"],
    ["vite-without-svgr", "src/App.tsx:App"],
    ["wrapper-custom", "src/App.tsx:App"],
    ["wrapper-default", "src/App.tsx:App"],
  ] as const) {
    const appDir = smokeTestApp(appName);
    previewTest([pluginFactory], appDir)(appName, async (preview) => {
      await preview.show(componentId);
      await preview.iframe.takeScreenshot(
        path.join(appDir, `__screenshot__${process.platform}.png`)
      );
    });
  }
});
