import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";
import { reactVersions } from "./react-versions";

const testApp = (suffix: string | number) =>
  path.join(__dirname, "apps", "react" + suffix);

for (const reactVersion of reactVersions()) {
  test.describe.parallel(`v${reactVersion}`, () => {
    test.describe.parallel("react/forwarded ref", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("renders forwarded ref component", async (preview) => {
        await preview.fileManager.update(
          "src/App.tsx",
          `import { forwardRef } from "react";

          const Input = forwardRef<HTMLInputElement>((props, ref) => {
            return <input className="forwarded" {...props} ref={ref} />;
          });
          Input.displayName = "ForwardRefInput";`
        );
        await preview.show("src/App.tsx:Input");
        await preview.iframe.waitForSelector(".forwarded");
      });
    });
  });
}
