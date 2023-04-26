import test from "@playwright/test";
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
      "nuxt2-app": ["pages/index.vue:index"],
      "vue2-app": ["src/App.vue:App"],
      "vue2-storybook": [
        "src/stories/Button.stories.js:Primary",
        "src/stories/Page.stories.js:LoggedOut",
        "src/stories/Page.stories.js:LoggedIn",
      ],
    },
  });
});
