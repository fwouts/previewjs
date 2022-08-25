import { expect, expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import solidPlugin from "@previewjs/plugin-solid";

export const consoleTests = testSuite(
  [solidPlugin],
  "solid/console",
  (test) => {
    test("shows logs", "solid", async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await controller.bottomPanel.tabs.get("Console").click();
      expect(await controller.console.container.visible()).toEqual(true);
      expect(await controller.console.items.count()).toEqual(0);

      await appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
function App() {
  console.log("Render 1");
  return (
    <div className="App-updated-1">
      Hello, World!
    </div>
  );
}`,
      });
      await previewIframe.waitForSelector(".App-updated-1");
      await controller.console.items.withText("Render 1").waitUntilVisible();
      expect(await controller.console.items.count()).toEqual(1);

      await appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
function App() {
  console.log("Render 2");
  return (
    <div className="App-updated-2">
      Hello, World!
    </div>
  );
}`,
      });
      await previewIframe.waitForSelector(".App-updated-2");
      await controller.console.items.withText("Render 2").waitUntilVisible();
      expect(await controller.console.items.count()).toEqual(1);
    });

    test(
      "hides errors once resolved",
      "solid",
      async ({ appDir, controller }) => {
        await appDir.update("src/App.tsx", {
          kind: "replace",
          text: `
export function Foo() {
  return <p className="init">Foo</p>
}`,
        });
        await controller.show("src/App.tsx:Foo");
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
          [`Unexpected keyword 'return'`, "Failed to reload"],
          [`Unexpected keyword 'return'`, "Failed to reload"],
          [`Missing initializer in const declaration`, "Failed to reload"],
          [`Missing initializer in const declaration`, "Failed to reload"],
          [`Missing initializer in const declaration`, "Failed to reload"],
          [`Missing initializer in const declaration`, "Failed to reload"],
          [`Unexpected token`, "Failed to reload"],
          [`Unexpected token`, "Failed to reload"],
          [`Unterminated string constant`, "Failed to reload"],
          [`Unterminated string constant`, "Failed to reload"],
          [`Unterminated string constant`, "Failed to reload"],
          null,
        ];
        for (let i = 0; i < append.length; i++) {
          const partialAppend = append.slice(0, i);
          await appDir.update(
            "src/App.tsx",
            {
              kind: "replace",
              text: `
function Foo() {
  ${partialAppend}
  return <p>Foo</p>
}`,
            },
            {
              inMemoryOnly: true,
            }
          );
          const expectedErrors = errors[i];
          await expectErrors(controller, expectedErrors || []);
        }
      }
    );
  }
);
