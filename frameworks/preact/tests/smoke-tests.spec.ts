import test from "@playwright/test";
import { smokeTests } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.parallel("smoke tests", () => {
  smokeTests({
    projectsDir: path.join(__dirname, "apps"),
    pluginFactory,
    componentIdsPerProject: {
      "preact-ts": ["src/components/app.tsx:App"],
      "storybook-js": ["src/App.jsx:App"],
      "storybook-ts": ["src/stories/Button.stories.tsx:Primary"],
      "vite-preact": ["src/app.tsx:App"],
    },
  });
});
