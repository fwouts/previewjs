import { testSuite } from "../../testing";

export const jsxTests = testSuite("vue3/jsx", (test) => {
  test("renders JSX component", "vue3", async ({ appDir, controller }) => {
    await appDir.update("src/Button.jsx", {
      kind: "replace",
      text: `
  export const Button = (props) => {
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
    "vue3",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.jsx", {
        kind: "replace",
        text: `
export const Button = (props) => {
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
