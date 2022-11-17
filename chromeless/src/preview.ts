import { RPCs } from "@previewjs/api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import {
  generateDefaultProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";
import type { Reader } from "@previewjs/vfs";
import type playwright from "playwright";
import { setupPreviewEventListener } from "./event-listener";
import { getPreviewIframe } from "./iframe";
import { render } from "./render";
import { createChromelessWorkspace } from "./workspace";

export async function startPreview({
  frameworkPluginFactories,
  page,
  rootDirPath,
  port,
  reader,
}: {
  frameworkPluginFactories: FrameworkPluginFactory[];
  page: playwright.Page;
  rootDirPath: string;
  port: number;
  reader?: Reader;
}) {
  const workspace = await createChromelessWorkspace({
    rootDirPath,
    reader,
    frameworkPluginFactories,
  });
  const preview = await workspace.preview.start(async () => port);
  await page.goto(preview.url());

  // This callback will be invoked each time a component is done rendering.
  let onRenderingDone = () => {
    // No-op by default.
  };
  const events = await setupPreviewEventListener(page, (event) => {
    if (event.kind === "rendering-done") {
      onRenderingDone();
    }
  });

  return {
    events,
    iframe: {
      async waitForSelector(
        selector: string,
        options: {
          state?: "attached" | "detached" | "visible" | "hidden";
        } = {}
      ) {
        const iframe = await getPreviewIframe(page);
        const element = await iframe.waitForSelector(selector, options);
        return element!;
      },
      async takeScreenshot(destinationPath: string) {
        const preview = await getPreviewIframe(page);
        preview.addStyleTag({
          content: `
*,
*::after,
*::before {
  transition-delay: 0s !important;
  transition-duration: 0s !important;
  animation-delay: -0.0001s !important;
  animation-duration: 0s !important;
  animation-play-state: paused !important;
  caret-color: transparent !important;
  color-adjust: exact !important;
}
`,
        });
        // Ensure all images are loaded.
        // Source: https://stackoverflow.com/a/49233383
        await preview.evaluate(async () => {
          const selectors = Array.from(document.querySelectorAll("img"));
          await Promise.all(
            selectors.map((img) => {
              if (img.complete) {
                return;
              }
              return new Promise<unknown>((resolve) => {
                const observer = new IntersectionObserver((entries) => {
                  if (entries[0]?.isIntersecting) {
                    img.addEventListener("load", resolve);
                    // If an image fails to load, ignore it.
                    img.addEventListener("error", resolve);
                  } else {
                    resolve(null);
                  }
                  observer.unobserve(img);
                });
                observer.observe(img);
              });
            })
          );
        });
        await page.screenshot({
          path: destinationPath,
        });
      },
    },
    async show(componentId: string, propsAssignmentSource?: string) {
      const filePath = componentId.split(":")[0]!;
      const { components } = await workspace.localRpc(RPCs.DetectComponents, {
        filePaths: [filePath],
      });
      const detectedComponents = components[filePath] || [];
      const matchingDetectedComponent = detectedComponents.find(
        (c) => componentId === `${filePath}:${c.name}`
      );
      if (!matchingDetectedComponent) {
        throw new Error(
          `Component may be previewable but was not detected by framework plugin: ${componentId}`
        );
      }
      const component = {
        componentName: matchingDetectedComponent.name,
        filePath,
      };
      const computePropsResponse = await workspace.localRpc(
        RPCs.ComputeProps,
        component
      );
      const defaultProps = generateDefaultProps(
        computePropsResponse.types.props,
        computePropsResponse.types.all
      );
      if (!propsAssignmentSource) {
        propsAssignmentSource = generatePropsAssignmentSource(
          computePropsResponse.types.props,
          defaultProps.keys,
          computePropsResponse.types.all
        );
      }
      const donePromise = new Promise<void>((resolve) => {
        onRenderingDone = resolve;
      });
      await render(page, {
        ...component,
        defaultPropsSource: defaultProps.source,
        propsAssignmentSource,
      });
      await donePromise;
    },
    async stop() {
      await preview.stop();
      await workspace.dispose();
    },
  };
}
