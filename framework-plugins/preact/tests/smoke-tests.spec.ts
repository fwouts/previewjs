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
      "preact-ts": ["src/components/app.tsx:App"],
      "vite-storybook-js": [
        "src/stories/Button.stories.jsx:Primary",
        "src/stories/Page.stories.jsx:LoggedOut",
        "src/stories/Page.stories.jsx:LoggedIn",
      ],
      "vite-storybook-ts": [
        "src/stories/Button.stories.tsx:Primary",
        "src/stories/Page.stories.tsx:LoggedOut",
        "src/stories/Page.stories.tsx:LoggedIn",
      ],
      "vite-preact": ["src/app.tsx:App"],
    },
  });
});
