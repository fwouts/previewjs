import solidPlugin from "@previewjs/plugin-solid";
import { describe, it } from "vitest";

describe("solid/storybook", () => {
  it("renders component with explicit args", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await appDir.update("src/Button.tsx", {
      kind: "replace",
      text: `
  const Button = ({ label }) => <button>{label}</button>;
  Button.args = {
    label: "Hello, World!"
  };
      `,
    });
    await controller.show("src/Button.tsx:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  it("renders component with default args", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await appDir.update("src/Button.tsx", {
      kind: "replace",
      text: `
  const Button = ({ label }) => <button>{label}</button>;

  export default {
    args: {
      label: "Hello, World!"
    }
  };
      `,
    });
    await controller.show("src/Button.tsx:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  it("renders component with explicit args over default args", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await appDir.update("src/Button.tsx", {
      kind: "replace",
      text: `
  const Button = ({ label }) => <button>{label}</button>;
  Button.args = {
    label: "explicit"
  };
  
  export default {
    args: {
      label: "default"
    }
  };
      `,
    });
    await controller.show("src/Button.tsx:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'explicit')]"
    );
  });
});
