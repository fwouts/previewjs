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
      "solid-js": ["src/SolidApp.jsx:default"],
      "solid-ts": ["src/App.tsx:App"],
      "solidstart-bare-ssr": ["src/components/Counter.tsx:default"],
    },
  });
});
