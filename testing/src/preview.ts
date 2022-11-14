/// <reference types="@previewjs/iframe/preview/window" />

import { RPCs } from "@previewjs/api";
import {
  createChromelessWorkspace,
  getPreviewIframe,
  render,
  setupPreviewEventListener,
} from "@previewjs/chromeless";
import type { FrameworkPluginFactory } from "@previewjs/core";
import {
  generateDefaultProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";
import fs from "fs-extra";
import getPort from "get-port";
import path from "path";
import type playwright from "playwright";
import { createPreviewEventListener } from "./events";
import { prepareFileManager } from "./file-manager";
import { prepareTestDir } from "./test-dir";

export async function startPreview({
  frameworkPluginFactories,
  page,
  workspaceDirPath,
  port,
}: {
  frameworkPluginFactories: FrameworkPluginFactory[];
  page: playwright.Page;
  workspaceDirPath: string;
  port: number;
}) {
  const rootDirPath = await prepareTestDir(workspaceDirPath);
  if (!port) {
    port = await getPort();
  }
  const { reader, fileManager } = await prepareFileManager(
    rootDirPath,
    async () => {
      try {
        const iframe = await page.$("iframe");
        if (!iframe) {
          // No iframe yet, so no need to expect anything to change.
          return;
        }
      } catch (e) {
        // Ignore, most likely due to whole-page refresh.
        return;
      }
      const frame = await getPreviewIframe(page);
      await frame.$eval("body", () => {
        return window.__expectFutureRefresh__();
      });
    }
  );
  const workspace = await createChromelessWorkspace({
    rootDirPath: rootDirPath,
    reader,
    frameworkPluginFactories: frameworkPluginFactories,
  });
  const preview = await workspace.preview.start(async () => port);
  await page.goto(preview.url());

  // This callback will be invoked each time a component is done rendering.
  let onRenderingDone = () => {
    // No-op by default.
  };
  const [eventListener, events] = createPreviewEventListener();
  await setupPreviewEventListener(page, (event) => {
    eventListener(event);
    if (event.kind === "rendering-done") {
      onRenderingDone();
    }
  });

  return {
    fileManager,
    events,
    iframe: {
      async waitForSelector(
        selector: string,
        options: {
          state?: "attached" | "detached" | "visible" | "hidden";
        } = {}
      ) {
        const iframe = await getPreviewIframe(page);
        return iframe.waitForSelector(selector, options);
      },
      waitForExpectedIframeRefresh: () => waitForExpectedIframeRefresh(page),
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
        const destinationDirPath = path.dirname(destinationPath);
        await fs.mkdirp(destinationDirPath);
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

async function waitForExpectedIframeRefresh(page: playwright.Page) {
  const frame = await getPreviewIframe(page);
  try {
    await frame.$eval("body", async () => {
      // It's possible that __waitForExpectedRefresh__ isn't ready yet.
      let waitStart = Date.now();
      while (
        !window.__waitForExpectedRefresh__ &&
        Date.now() - waitStart < 5000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return window.__waitForExpectedRefresh__();
    });
  } catch (e: any) {
    if (
      e.message.includes(
        "Execution context was destroyed, most likely because of a navigation"
      )
    ) {
      await waitForExpectedIframeRefresh(page);
    } else {
      throw e;
    }
  }
}
