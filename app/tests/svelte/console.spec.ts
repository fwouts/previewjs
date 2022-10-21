import { expect, expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import sveltePlugin from "@previewjs/plugin-svelte";

export const consoleTests = testSuite(
  [sveltePlugin],
  "svelte/console",
  (test) => {
    test("shows logs", "svelte", async ({ appDir, controller }) => {
      await controller.show("src/App.svelte:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
      await controller.bottomPanel.tabs.get("Console").click();
      expect(await controller.console.container.visible()).toEqual(true);
      expect(await controller.console.items.count()).toEqual(0);

      await appDir.update("src/App.svelte", {
        kind: "replace",
        text: `
<div class="App-updated-1">
  {foo}
</div>

<script>
export let foo = 123;
console.log("Render 1");
</script>
`,
      });
      await previewIframe.waitForSelector(".App-updated-1");
      await controller.console.items.withText("Render 1").waitUntilVisible();
      expect(await controller.console.items.count()).toEqual(1);

      await appDir.update("src/App.svelte", {
        kind: "replace",
        text: `
<div class="App-updated-2">
  {foo}
</div>

<script>
export let foo = 123;
console.log("Render 2");
</script>
`,
      });
      await previewIframe.waitForSelector(".App-updated-2");
      await controller.console.items.withText("Render 2").waitUntilVisible();
      expect(await controller.console.items.count()).toEqual(1);
    });

    test(
      "hides errors once resolved",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/App.svelte", {
          kind: "replace",
          text: `
<div class="init">
  Hello, World!
</div>
`,
        });
        await controller.show("src/App.svelte:Foo", {
          expectMissing: true,
        });
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".init");
        await controller.bottomPanel.tabs.get("Console").click();
        expect(await controller.console.container.visible()).toEqual(true);
        expect(await controller.console.items.count()).toEqual(0);

        const append = 'const foo = "hi";';
        const errors = [
          null,
          ["c is not defined"],
          ["co is not defined"],
          ["con is not defined"],
          ["cons is not defined"],
          ["cons is not defined", "Unexpected token"],
          ["cons is not defined", "Unexpected token"],
          ["cons is not defined", "Unexpected token"],
          ["cons is not defined", "Unexpected token", "Unexpected token"],
          ["cons is not defined", "Unexpected token", "Unexpected token"],
          ["cons is not defined", "Unexpected token", "Unexpected token"],
          [
            "cons is not defined",
            "Unexpected token",
            "Unexpected token",
            "Unexpected token",
          ],
          [
            "cons is not defined",
            "Unexpected token",
            "Unexpected token",
            "Unexpected token",
          ],
          [
            "cons is not defined",
            "Unexpected token",
            "Unexpected token",
            "Unexpected token",
            "Unterminated string constant",
          ],
          [
            "cons is not defined",
            "Unexpected token",
            "Unexpected token",
            "Unexpected token",
            "Unterminated string constant",
          ],
          [
            "cons is not defined",
            "Unexpected token",
            "Unexpected token",
            "Unexpected token",
            "Unterminated string constant",
          ],
          null,
        ];
        for (let i = 0; i < append.length; i++) {
          const partialAppend = append.slice(0, i);
          await appDir.update(
            "src/App.svelte",
            {
              kind: "replace",
              text: `
<div class="App-updated-2">
  Hello, World!
</div>

<script>
${partialAppend}
</script>
`,
            },
            {
              inMemoryOnly: true,
            }
          );
          const expectedErrors = errors[i];
          await expectErrors(
            controller,
            {
              fullscreen: false,
            },
            expectedErrors || []
          );
        }
      }
    );
  }
);
