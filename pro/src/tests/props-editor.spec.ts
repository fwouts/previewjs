import { expect, testSuite } from "@previewjs/app/testing";

export const propsEditorTests = testSuite("props editor", (test) => {
  test("uses generated props", "samples/default", async ({ controller }) => {
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
});
