import test from "@playwright/test";
import { smokeTests } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.parallel("smoke tests", () => {
  smokeTests({
    projectsDir: path.join(__dirname, "apps"),
    pluginFactory,
    componentIdsPerProject: {
      "nuxt3-app": ["app.vue:app"],
      "vue3-app": ["src/App.vue:App"],
    },
  });
});
