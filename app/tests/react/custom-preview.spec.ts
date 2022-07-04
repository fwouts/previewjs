import reactPlugin from "@previewjs/plugin-react";
import { describe, it } from "vitest";

const originalSource = `
import React from "react";

export function Button(props: { label: string; disabled?: boolean }) {
  return (
    <button id="button" disabled={props.disabled}>
      {props.label}
    </button>
  );
}
`;

describe("react/custom preview", () => {
  for (const version of [16, 17, 18]) {
    it("shows variants when already configured", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default variant",
  },
  disabled: {
    label: "disabled variant",
    disabled: true,
  },
});
`,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default variant')]"
      );
    });

    it("shows variants once preview added and hides once removed", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default variant",
  },
  disabled: {
    label: "disabled variant",
    disabled: true,
  },
});
`,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default variant')]"
      );

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default variant')]",
        {
          state: "hidden",
        }
      );
      await previewIframe.waitForSelector("#button");
    });

    it("supports variants defined as function", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, () => ({
  default: {
    label: "custom label",
  },
}));
`,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'custom label')]"
      );
    });

    it("updates when preview is updated", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default",
  },
  disabled: {
    label: "disabled",
    disabled: true,
  },
});
`,
      });

      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default')]"
      );

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "foo label",
  },
  bar: {
    label: "bar label",
    disabled: true,
  },
});
`,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'foo label')]"
      );
    });

    it("hides props editor for configured variants", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await controller.props.editor.isReady();

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default",
  },
});
`,
      });

      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default')]"
      );
      await controller.props.editor.waitUntilGone();

      await controller.component.label().click();
      await controller.props.editor.isReady();

      await controller.props.editor.replaceText(`properties = {
        label: "foo"
      }`);
      await previewIframe.waitForSelector("xpath=//button[contains(., 'foo')]");
    });
  }
});
