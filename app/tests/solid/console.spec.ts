import { expect, testSuite } from "../../testing";
import { expectErrors } from "../../testing/helpers/expect-errors";

export const consoleTests = testSuite("solid/console", (test) => {
  test("shows logs", "solid", async ({ appDir, controller }) => {
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await controller.bottomPanel.tabs.get("Console").click();
    expect(await controller.console.container.visible()).toEqual(true);
    expect(await controller.console.items.count()).toEqual(0);

    appDir.update("src/App.tsx", {
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

    appDir.update("src/App.tsx", {
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
      appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
function Foo() {
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
        [`Expected identifier but found "return"`, "Failed to reload"],
        [`Expected identifier but found "return"`, "Failed to reload"],
        [`The constant "f" must be initialized`, "Failed to reload"],
        [`The constant "fo" must be initialized`, "Failed to reload"],
        [`The constant "foo" must be initialized`, "Failed to reload"],
        [`The constant "foo" must be initialized`, "Failed to reload"],
        [`Unexpected "return"`, "Failed to reload"],
        [`Unexpected "return"`, "Failed to reload"],
        [`Unterminated string literal`, "Failed to reload"],
        [`Unterminated string literal`, "Failed to reload"],
        [`Unterminated string literal`, "Failed to reload"],
        null,
      ];
      for (let i = 0; i < append.length; i++) {
        const partialAppend = append.slice(0, i);
        appDir.update(
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
        // TODO: Remove this horrible wait.
        await new Promise((resolve) => setTimeout(resolve, 200));
        await expectErrors(controller, expectedErrors || []);
      }
    }
  );
});
