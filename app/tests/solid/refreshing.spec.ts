import { expect, testSuite, waitFor } from "@previewjs/e2e-test-runner";
import solidPlugin from "@previewjs/plugin-solid";

export const refreshingTests = testSuite(
  [solidPlugin],
  "solid/refreshing",
  (test) => {
    test("renders top-level component", "solid", async ({ controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
    });

    test(
      "renders top-level component after file system change",
      "solid",
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await appDir.update("src/App.tsx", {
          kind: "edit",
          search: `className="App"`,
          replace: `className="App-modified"`,
        });
        await previewIframe.waitForSelector(".App-modified");
      }
    );

    test(
      "renders top-level component after in-memory change",
      "solid",
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await appDir.update(
          "src/App.tsx",
          {
            kind: "edit",
            search: `className="App"`,
            replace: `className="App-modified"`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await previewIframe.waitForSelector(".App-modified");
      }
    );

    test(
      "renders updated dependency after file system change",
      "solid",
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".Dependency");
        await appDir.update("src/Dependency.tsx", {
          kind: "edit",
          search: `className="Dependency"`,
          replace: `className="Dependency-modified"`,
        });
        await previewIframe.waitForSelector(".Dependency-modified");
      }
    );

    test(
      "renders updated dependency after in-memory change",
      "solid",
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".Dependency");
        await appDir.update(
          "src/Dependency.tsx",
          {
            kind: "edit",
            search: `className="Dependency"`,
            replace: `className="Dependency-modified"`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await previewIframe.waitForSelector(".Dependency-modified");
      }
    );

    test(
      "renders updated CSS after file system change",
      "solid",
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        const dependencyComponent = await previewIframe.waitForSelector(
          ".Dependency"
        );
        expect((await dependencyComponent?.boundingBox())?.width).toEqual(200);
        await appDir.update("src/App.css", {
          kind: "edit",
          search: `width: 200px`,
          replace: `width: 400px`,
        });
        await waitFor(
          async () => (await dependencyComponent?.boundingBox())?.width === 400
        );
      }
    );

    test(
      "renders updated CSS after in-memory change",
      "solid",
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        const dependencyComponent = await previewIframe.waitForSelector(
          ".Dependency"
        );
        expect((await dependencyComponent?.boundingBox())?.width).toEqual(200);
        await appDir.update(
          "src/App.css",
          {
            kind: "edit",
            search: `width: 200px`,
            replace: `width: 400px`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await waitFor(
          async () => (await dependencyComponent?.boundingBox())?.width === 400
        );
      }
    );

    test(
      "switches to another component back and forth smoothly",
      "solid",
      async ({ controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await controller.show("src/Other.tsx:Other");
        await previewIframe.waitForSelector(".Other");
        await controller.show("src/App.tsx:App");
        await previewIframe.waitForSelector(".App-logo");
      }
    );
  }
);
