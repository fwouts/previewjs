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
    ids: {
      "nuxt-app": ["app.vue:app"],
      "nuxt3-app": ["app.vue:app"],
      "vue3-app": ["src/App.vue:App"],
      "vite-storybook-js": [
        "src/stories/Button.stories.js:Primary",
        "src/stories/Page.stories.js:LoggedOut",
        "src/stories/Page.stories.js:LoggedIn",
      ],
      "vite-storybook-ts": [
        "src/stories/Button.stories.ts:Primary",
        "src/stories/Page.stories.ts:LoggedOut",
        "src/stories/Page.stories.ts:LoggedIn",
      ],
    },
  });
});
