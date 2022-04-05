import { testSuite } from "../../testing";

const originalSource = `
export function Button(props: { label: string; disabled?: boolean }) {
  return (
    <button id="button" disabled={props.disabled}>
      {props.label}
    </button>
  );
}
`;

export const customPreviewTests = testSuite("solid/custom preview", (test) => {
  test(
    "shows variants when already configured",
    "solid",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-solid/setup';
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
    }
  );

  test(
    "shows variants once preview added and hides once removed",
    "solid",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-solid/setup';
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
    }
  );

  test(
    "supports variants defined as function",
    "solid",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-solid/setup';
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
    }
  );

  test(
    "updates when preview is updated",
    "solid",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-solid/setup';
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
        text: `import { setupPreviews } from '@previewjs/plugin-solid/setup';
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
    }
  );

  test(
    "hides props editor for configured variants",
    "solid",
    async ({ appDir, controller }) => {
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
        text: `import { setupPreviews } from '@previewjs/plugin-solid/setup';
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
    }
  );
});
