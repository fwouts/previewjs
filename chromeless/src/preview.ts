import { RPCs } from "@previewjs/api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import type { Variant } from "@previewjs/iframe";
import {
  generateDefaultProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";
import type { Reader } from "@previewjs/vfs";
import type playwright from "playwright";
import { setupPreviewEventListener } from "./event-listener";
import { getPreviewIframe } from "./iframe";
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
  let variants: Variant[] = [];
  const events = await setupPreviewEventListener(page, (event) => {
    if (event.kind === "rendering-setup") {
      variants = event.info.variants || [];
    } else if (event.kind === "rendering-done") {
      onRenderingDone();
    }
  });

  return {
    events,
    iframe: {
      async waitForIdle() {
        await waitUntilNetworkIdle(page);
      },
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
    async show(
      componentId: string,
      propsAssignmentSource?: string | { variantKey: string }
    ) {
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
      let variantKey: string | null = null;
      if (!propsAssignmentSource) {
        propsAssignmentSource = generatePropsAssignmentSource(
          computePropsResponse.types.props,
          defaultProps.keys,
          computePropsResponse.types.all
        );
      } else if (typeof propsAssignmentSource !== "string") {
        variantKey = propsAssignmentSource.variantKey;
        propsAssignmentSource = `properties = variants?.find(v => v.key === "${variantKey}")?.props || {}`;
      }
      const donePromise = new Promise<void>((resolve) => {
        onRenderingDone = resolve;
      });
      await waitUntilNetworkIdle(page);
      await page.evaluate(
        async (component) => {
          // It's possible that window.renderComponent isn't ready yet.
          let waitStart = Date.now();
          while (!window.renderComponent && Date.now() - waitStart < 5000) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          window.renderComponent(component);
        },
        {
          ...component,
          defaultPropsSource: defaultProps.source,
          propsAssignmentSource,
        }
      );
      await donePromise;
      if (variantKey && !variants.find((v) => v.key === variantKey)) {
        throw new Error(
          `No variant with key: ${variantKey}. Available variants: ${
            variants.map((v) => v.key).join(", ") || "none"
          }`
        );
      }
      await waitUntilNetworkIdle(page);
    },
    async stop() {
      await preview.stop();
      await workspace.dispose();
    },
  };
}

async function waitUntilNetworkIdle(page: playwright.Page) {
  await page.waitForLoadState("networkidle");
  try {
    await (await getPreviewIframe(page)).waitForLoadState("networkidle");
  } catch (e) {
    // It's OK for the iframe to be replaced by another one, in which case wait again.
    await (await getPreviewIframe(page)).waitForLoadState("networkidle");
  }
}
