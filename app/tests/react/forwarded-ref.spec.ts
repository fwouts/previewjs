import { testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";

export const forwardedRefTests = testSuite(
  [reactPlugin],
  "react/forwarded-ref",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/renders forwarded ref component`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/App.tsx", {
            kind: "replace",
            text: `
import { forwardRef } from "react";

const Input = forwardRef<HTMLInputElement>((props, ref) => {
  return <input className="forwarded" {...props} ref={ref} />;
});
Input.displayName = "ForwardRefInput";
    `,
          });
          await controller.show("src/App.tsx:Input");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(".forwarded");
        }
      );
    }
  }
);
