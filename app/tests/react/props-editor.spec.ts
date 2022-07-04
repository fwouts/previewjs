import { expect } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";
import { describe, it } from "vitest";

describe("react/props editor", () => {
  for (const version of [16, 17, 18]) {
    it("updates when switching components", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      const modifiedCode = `
properties = {
  foo: "bar"
};
`.trim();
      await controller.props.editor.replaceText(modifiedCode);
      expect(await controller.props.editor.getText()).toEqual(modifiedCode);
      await controller.show("src/Other.tsx:Other");
      await previewIframe.waitForSelector(".Other");
      expect(await controller.props.editor.getText()).toNotEqual(modifiedCode);
    });

    it("uses generated props", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      expect(await controller.props.editor.getText()).toEqual(
        `
properties = {
  children: "children",
  foo: {
    bar: "foo.bar",
  },
  complex: {
    bar: "hi!",
  },
};
`.trim()
      );
      await controller.show("src/Other.tsx:Other");
      await previewIframe.waitForSelector(".Other");
      expect(await controller.props.editor.getText()).toEqual(
        `
properties = {};
`.trim()
      );
    });

    it("resets props when refresh button is clicked", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      const originalCode = await controller.props.editor.getText();
      const modifiedCode = `
properties = {
  foo: "bar"
}
    `.trim();
      await controller.props.editor.replaceText(modifiedCode);
      expect(await controller.props.editor.getText()).toEqual(modifiedCode);

      await controller.props.refreshButton.click();
      expect(await controller.props.editor.getText()).toEqual(originalCode);
    });

    it("controls props", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update(
        "src/Button.tsx",
        {
          kind: "replace",
          text: `
import React from "react";
export function Button(props: { label: string; disabled?: boolean }) {
  return (
    <button id="button" disabled={props.disabled}>
      {props.label}
    </button>
  );
}
`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.show("src/Button.tsx:Button");
      await controller.props.editor.replaceText(`
properties = {
  label: "label"
};
`);
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'label')]"
      );

      await controller.props.editor.replaceText(`
properties = {
  label: "updated"
};
`);
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'updated')]"
      );
    });

    it("keeps invocation source when switching back and forth", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      const modifiedCode = `
properties = {
  label: "modified"
};
`.trim();
      await controller.props.editor.replaceText(modifiedCode);

      await controller.show("src/Other.tsx:Other");
      await previewIframe.waitForSelector(".Other");
      expect(await controller.props.editor.getText()).toNotEqual(modifiedCode);
      await controller.show("src/App.tsx:App");
      await previewIframe.waitForSelector(".App-logo");
      expect(await controller.props.editor.getText()).toEqual(modifiedCode);
    });
  }
});
