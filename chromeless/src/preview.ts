// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../client/src/index.ts" />

import type { Workspace } from "@previewjs/core";
import {
  generateCallbackProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";
import type playwright from "playwright";
import ts from "typescript";
import { getPreviewIframe } from "./iframe.js";
import { setupPreviewStateListener } from "./state-listener.js";

export async function startPreview({
  workspace,
  page,
  ...options
}: {
  workspace: Workspace;
  page: playwright.Page;
} & Parameters<Workspace["startServer"]>[0]) {
  const preview = await workspace.startServer(options);
  await page.goto(`http://localhost:${preview.port}`);

  // This callback will be invoked each time a previewable is done rendering.
  let onRenderingDone = () => {
    // No-op by default.
  };
  let onRenderingError = (_e: any) => {
    // No-op by default.
  };

  const getState = await setupPreviewStateListener(page, (state) => {
    if (state.rendered) {
      onRenderingDone();
    } else if (state.errors.length > 0) {
      onRenderingError(new Error(state.errors[0]!.message));
    }
  });

  return {
    getState,
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
    async show(previewableId: string, propsAssignmentSource?: string) {
      const filePath = previewableId.split(":")[0]!;
      const { components, stories } = await workspace.crawlFiles([filePath]);
      const matchingComponent = components.find((c) => previewableId === c.id);
      const matchingStory = stories.find((c) => previewableId === c.id);
      if (!matchingComponent && !matchingStory) {
        throw new Error(
          `Component may be previewable but was not detected by framework plugin: ${previewableId}`
        );
      }
      const component = matchingComponent || matchingStory?.associatedComponent;
      const { props, types } = await (component?.analyze() || {
        props: { kind: "unknown" as const },
        types: {},
      });
      const autogenCallbackProps = await generateCallbackProps(props, types);
      const autogenCallbackPropsSource = transpile(
        `autogenCallbackProps = ${autogenCallbackProps.source}`
      );
      if (!propsAssignmentSource) {
        if (matchingStory) {
          propsAssignmentSource = "properties = null";
        } else {
          propsAssignmentSource = await generatePropsAssignmentSource(
            props,
            autogenCallbackProps.keys,
            types
          );
        }
      }
      const donePromise = new Promise<void>((resolve, reject) => {
        onRenderingDone = resolve;
        onRenderingError = reject;
      });
      await waitUntilNetworkIdle(page);
      await page.evaluate(
        async ([previewableId, options]) => {
          // It's possible that window.loadIframePreview isn't ready yet.
          let waitStart = Date.now();
          const timeoutSeconds = 10;
          while (
            !window.loadIframePreview &&
            Date.now() - waitStart < timeoutSeconds * 1000
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          if (!window.loadIframePreview) {
            throw new Error(
              `window.loadIframePreview() isn't available after waiting ${timeoutSeconds} seconds`
            );
          }
          window.loadIframePreview(previewableId, options);
        },
        [
          previewableId,
          {
            autogenCallbackPropsSource,
            propsAssignmentSource: transpile(propsAssignmentSource!),
          },
        ] as const
      );
      await donePromise;
      await waitUntilNetworkIdle(page);
    },
    async stop() {
      await preview.stop();
    },
  };
}

function transpile(source: string) {
  // Transform JSX if required.
  try {
    return ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        jsxFactory: "__jsxFactory__",
      },
    }).outputText;
  } catch (e) {
    throw new Error(`Error transforming source:\n${source}\n\n${e}`);
  }
}

async function waitUntilNetworkIdle(page: playwright.Page) {
  await page.waitForLoadState("networkidle");
  try {
    await (await getPreviewIframe(page)).waitForLoadState("networkidle");
  } catch {
    // It's OK for the iframe to be replaced by another one, in which case wait again.
    await (await getPreviewIframe(page)).waitForLoadState("networkidle");
  }
}
