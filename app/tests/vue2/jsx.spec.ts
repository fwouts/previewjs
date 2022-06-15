import vue2Plugin from "@previewjs/plugin-vue2";
import { testSuite } from "../../testing";

export const jsxTests = testSuite([vue2Plugin], "vue2/jsx", (test) => {
  test("renders JSX component", "vue2", async ({ appDir, controller }) => {
    await appDir.update("src/Button.jsx", {
      kind: "replace",
      text: `
export const Button = ({props}) => {
  return <button>
    {props.label || "a button"}
  </button>
}
        `,
    });
    await controller.show("src/Button.jsx:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'a button')]"
    );
  });

  test(
    "renders JSX component with previews",
    "vue2",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.jsx", {
        kind: "replace",
        text: `
export const Button = ({ props }) => {
  return <button>
    {props.label || "a button"}
  </button>
}

Button.previews = {
  default: {
    label: "Hello, World!"
  }
}
        `,
      });
      await controller.show("src/Button.jsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'Hello, World!')]"
      );
    }
  );
});
