import { test } from "./lib";

test.describe("navigation", () => {
  test("foo", async ({ page, runInPage }) => {
    await runInPage(async (message) => {
      const { default: App } = await import("./App");

      await mount(<App title={message} />);
    }, "hello world");

    await page.waitForSelector("text=hello world");
    await page.screenshot({
      path: "src/example.spec.output.png",
    });
  });
});
