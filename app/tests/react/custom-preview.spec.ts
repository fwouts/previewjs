import { testSuite } from "../../testing";

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

export const customPreviewTests = testSuite("react/custom preview", (test) => {
  for (const version of [16, 17, 18]) {
    test(
      `${version}/shows variants when already configured`,
      `react${version}`,
      async ({ appDir, controller }) => {
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
      }
    );

    test(
      `${version}/shows variants once preview added and hides once removed`,
      `react${version}`,
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
      }
    );

    test(
      `${version}/supports variants defined as function`,
      `react${version}`,
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
      }
    );

    test(
      `${version}/updates when preview is updated`,
      `react${version}`,
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
      }
    );

    test(
      `${version}/hides props editor for configured variants`,
      `react${version}`,
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
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'foo')]"
        );
      }
    );
  }
});
