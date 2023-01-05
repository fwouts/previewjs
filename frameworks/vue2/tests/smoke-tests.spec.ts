import test from "@playwright/test";
import { smokeTests } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.parallel("smoke tests", () => {
  smokeTests({
    projectsDir: path.join(__dirname, "apps"),
    pluginFactory,
    componentIdsPerProject: {
      "nuxt2-app": ["pages/index.vue:index"],
      "vue2-app": ["src/App.vue:App"],
      "vue2-storybook": ["src/stories/Button.stories.js:Primary"],
    },
  });
});
