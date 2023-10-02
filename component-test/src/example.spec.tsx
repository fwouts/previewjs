import path from "path";
import url from "url";
import { previewjsFixture } from "./lib";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const test = previewjsFixture(path.join(__dirname, ".."));

test.describe("navigation", () => {
  test("foo", async ({ page, runInPage }) => {
    await runInPage(
      __dirname,
      async (message) => {
        const { default: App } = await import("./App");
        const { Foo } = await import("./Foo");

        await mount(<App title={message} />);
      },
      "hello world"
    );

    await page.screenshot({
      path: "src/example.spec.output.png",
    });
  });
});
