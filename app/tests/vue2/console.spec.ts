import { expect, expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import vue2Plugin from "@previewjs/plugin-vue2";

export const consoleTests = testSuite([vue2Plugin], "vue2/console", (test) => {
  test("shows logs", "vue2", async ({ appDir, controller }) => {
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#app");
    await controller.bottomPanel.tabs.get("Console").click();
    expect(await controller.console.container.visible()).toEqual(true);
    expect(await controller.console.items.count()).toEqual(0);

    await appDir.update("src/App.vue", {
      kind: "replace",
      text: `
<template>
  <div class="App-updated-1">
    Hello, World!
  </div>
</template>

<script>
export default {
  name: "App",
  created() {
    console.log("Render 1");
  }
};
</script>
`,
    });
    await previewIframe.waitForSelector(".App-updated-1");
    await controller.console.items.withText("Render 1").waitUntilVisible();
    expect(await controller.console.items.count()).toEqual(1);

    await appDir.update("src/App.vue", {
      kind: "replace",
      text: `
<template>
  <div class="App-updated-2">
    Hello, World!
  </div>
</template>

<script>
export default {
  name: "App",
  created() {
    console.log("Render 2");
  }
};
</script>
`,
    });
    await previewIframe.waitForSelector(".App-updated-2");
    await controller.console.items.withText("Render 2").waitUntilVisible();
    expect(await controller.console.items.count()).toEqual(1);
  });

  test("hides errors once resolved", "vue2", async ({ appDir, controller }) => {
    await appDir.update("src/App.vue", {
      kind: "replace",
      text: `
<template>
  <div class="init">
    Hello, World!
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>
`,
    });
    await controller.show("src/App.vue:Foo", {
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
      ["c is not defined", "Failed to reload"],
      ["co is not defined", "Failed to reload"],
      ["con is not defined", "Failed to reload"],
      ["cons is not defined", "Failed to reload"],
      [`Unexpected token 'const'`, "Failed to reload"],
      [`Unexpected token 'const'`, "Failed to reload"],
      [`Missing initializer in const declaration`, "Failed to reload"],
      [`Missing initializer in const declaration`, "Failed to reload"],
      [`Missing initializer in const declaration`, "Failed to reload"],
      [`Missing initializer in const declaration`, "Failed to reload"],
      [`Unexpected token 'const'`, "Failed to reload"],
      [`Unexpected token 'const'`, "Failed to reload"],
      [`Failed to parse source`, "Failed to reload"],
      [`Failed to parse source`, "Failed to reload"],
      [`Failed to parse source`, "Failed to reload"],
      null,
    ];
    for (let i = 0; i < append.length; i++) {
      const partialAppend = append.slice(0, i);
      await appDir.update(
        "src/App.vue",
        {
          kind: "replace",
          text: `
<template>
  <div class="App-updated-2">
    Hello, World!
  </div>
</template>

<script>
${partialAppend}
export default {
  name: "App",
};
</script>
`,
        },
        {
          inMemoryOnly: true,
        }
      );
      const expectedErrors = errors[i];
      await expectErrors(controller, expectedErrors || []);
    }
  });
});
