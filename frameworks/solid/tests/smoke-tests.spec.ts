import test from "@playwright/test";
import { smokeTests } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.parallel("smoke tests", () => {
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
