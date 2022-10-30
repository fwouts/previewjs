import { testSuite } from "@previewjs/e2e-test-runner";
import sveltePlugin from "@previewjs/plugin-svelte";

export const actionLogsTests = testSuite(
  [sveltePlugin],
  "svelte/action logs",
  (test) => {
    test(
      "shows action logs on link click",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/App.svelte", {
          kind: "replace",
          text: `
<a id="link" href="https://www.google.com">
  Hello, World!
</a>
`,
        });
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector("#link");
        await previewIframe.click("#link");
        const actionLog = await controller.actionLog.get(
          "Redirect prevented: https://www.google.com"
        );
        await actionLog.waitUntilVisible();
        await actionLog.waitUntilGone();
      }
    );
  }
);
