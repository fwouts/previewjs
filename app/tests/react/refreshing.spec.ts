import { expect, testSuite, waitFor } from "../../testing";

export const refreshingTests = testSuite("react/refreshing", (test) => {
  for (const version of [16, 17, 18]) {
    test(
      `${version}/renders top-level component`,
      `react${version}`,
      async ({ controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
      }
    );

    test(
      `${version}/renders top-level component after file system change`,
      `react${version}`,
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
      `${version}/renders top-level component after in-memory change`,
      `react${version}`,
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
      `${version}/renders updated dependency after file system change`,
      `react${version}`,
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
      `${version}/renders updated dependency after in-memory change`,
      `react${version}`,
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
      `${version}/renders updated CSS after file system change`,
      `react${version}`,
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
      `${version}/renders updated CSS after in-memory change`,
      `react${version}`,
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
      `${version}/switches to another component back and forth smoothly in different files`,
      `react${version}`,
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

    test(
      `${version}/switches to another component back and forth smoothly in same file files`,
      `react${version}`,
      async ({ controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await controller.show("src/App.tsx:Other");
        await previewIframe.waitForSelector(".OtherSameFile");
        await controller.show("src/App.tsx:App");
        await previewIframe.waitForSelector(".App-logo");
      }
    );
  }
});
