/// <reference types="@previewjs/iframe/preview/window" />

import type { Preview, Workspace } from "@previewjs/core";
import fs from "fs-extra";
import path from "path";
import type playwright from "playwright";

export class AppController {
  private preview: Preview | null = null;

  constructor(
    private readonly page: playwright.Page,
    private readonly workspace: Workspace,
    readonly port: number
  ) {}

  async start() {
    this.preview = await this.workspace.preview.start(async () => this.port);
  }

  async stop() {
    await this.preview?.stop();
    this.preview = null;
  }

  async waitForIdle() {
    await this.page.waitForLoadState("networkidle");
    try {
      await (await this.previewIframe()).waitForLoadState("networkidle");
    } catch (e) {
      // It's OK for the iframe to be replace by another one, in which case wait again.
      await (await this.previewIframe()).waitForLoadState("networkidle");
    }
  }

  previewIframe = async () => {
    let iframe: playwright.ElementHandle<Element> | null = null;
    let frame: playwright.Frame | null = null;
    while (!frame) {
      iframe = await this.page.waitForSelector("iframe");
      if (iframe) {
        frame = await iframe.contentFrame();
      }
    }
    return frame;
  };

  async onBeforeFileUpdated() {
    try {
      const iframe = await this.page.$("iframe");
      if (!iframe) {
        // No iframe yet, so no need to expect anything to change.
        return;
      }
    } catch (e) {
      // Ignore, most likely due to whole-page refresh.
      return;
    }
    const frame = await this.previewIframe();
    await frame.$eval("body", () => {
      return window.__expectFutureRefresh__();
    });
  }

  async waitForExpectedIframeRefresh() {
    const frame = await this.previewIframe();
    await frame.$eval("body", () => {
      return window.__waitForExpectedRefresh__();
    });
  }

  async show(componentId: string) {
    if (!this.preview) {
      throw new Error(`Preview server is not started.`);
    }
    const previewBaseUrl = this.preview.url();
    const url = `${previewBaseUrl}?p=${componentId}`;
    if (this.page.url().startsWith(previewBaseUrl)) {
      // Soft refresh.
      await this.page.evaluate((componentId: string) => {
        // @ts-ignore
        window.__previewjs_navigate(componentId);
      }, componentId);
    } else {
      // Hard refresh.
      await this.page.goto(url);
    }
  }

  async takeScreenshot(waitForSelector: string, destinationPath: string) {
    const preview = await this.previewIframe();
    await preview.waitForSelector(waitForSelector);
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
          return new Promise((resolve) => {
            img.addEventListener("load", resolve);
            // If an image fails to load, ignore it.
            img.addEventListener("error", resolve);
          });
        })
      );
    });
    const destinationDirPath = path.dirname(destinationPath);
    await fs.mkdirp(destinationDirPath);
    await this.waitForIdle();
    await this.page.screenshot({
      path: destinationPath,
    });
  }

  noSelection = this.element("#no-selection");

  appError = this.element("#app-error");

  component = {
    label: () => {
      return this.element("#component-label");
    },
  };

  variant = {
    get: (label: string) => {
      return this.element(
        `xpath=//*[contains(@class, 'variant')][contains(., '${label}')]`
      );
    },
    selected: () => {
      return this.element("#selected-variant");
    },
  };

  bottomPanel = {
    tabs: {
      get: (label: string) => {
        return this.element(
          `xpath=//button[contains(@class, 'panel-tab')][contains(., '${label}')]`
        );
      },
      selected: () => {
        return this.element(".panel-tab-selected");
      },
    },
  };

  actionLog = {
    get: (label: string) => {
      return this.element(
        `xpath=//*[contains(@class, 'action-log')][contains(., '${label}')]`
      );
    },
  };

  console = {
    container: this.element("#console-container"),
    clearButton: this.element("#clear-console-button"),
    notificationCount: this.element(".notification-count"),
    items: {
      at: async (index: number) => {
        return this.element(`.console-item:nth-child(${index + 1})`);
      },
      count: async () => {
        return (await this.page.$$(".console-item")).length;
      },
      withText: (text: string) => {
        return this.element(
          `xpath=//*[contains(@class, 'console-item')][contains(., '${text}')]`
        );
      },
    },
  };

  props = {
    refreshButton: this.element("#editor-refresh-button"),
    editor: (() => {
      const getText = async () => {
        const editorContent = await this.page.waitForSelector(
          "#editor-content",
          {
            state: "attached",
          }
        );
        if (!editorContent) {
          throw new Error(`#editor-content not found`);
        }
        return editorContent.evaluate(
          (element) => element.getAttribute("data-value") as string
        );
      };
      return {
        ...this.element("#editor-content"),
        isReady: async () => {
          return this.element("#editor-ready").waitUntilExists();
        },
        getText,
        replaceText: async (text: string) => {
          await this.page.waitForSelector(".monaco-editor");
          await this.page.click(".monaco-editor");
          const currentText = await getText();
          for (let i = 0; i < currentText.length; i++) {
            await this.page.keyboard.press("ArrowRight");
            await this.page.keyboard.press("Backspace");
          }
          for (let i = 0; i < text.length; i++) {
            await this.page.type(".monaco-editor", text.charAt(i));
            if ((await getText()).length > i + 1) {
              // Erase any automatically inserted brackets, etc.
              await this.page.keyboard.press("ArrowRight");
              await this.page.keyboard.press("Backspace");
            }
          }
        },
      };
    })(),
  };

  element(selector: string) {
    const getter = () => {
      return this.page.$(selector);
    };
    const methods = {
      visible: async () => {
        return !!(await this.page.$(selector));
      },
      waitUntilVisible: async () => {
        await this.page.waitForSelector(selector, {
          state: "attached",
        });
      },
      waitUntilExists: async () => {
        await this.page.waitForSelector(selector, {
          state: "attached",
        });
      },
      waitUntilGone: async () => {
        await this.page.waitForSelector(selector, {
          state: "hidden",
        });
      },
      className: async () => {
        const element = await getter();
        if (!element) {
          throw new Error(`${selector} not found`);
        }
        return element.evaluate((element) => element.className);
      },
      text: async () => {
        const element = await getter();
        if (!element) {
          return null;
        }
        return element.evaluate((element) => element.textContent);
      },
      click: async () => {
        const element = await getter();
        if (!element) {
          throw new Error(`${selector} not found`);
        }
        await element.click();
      },
    };
    return methods;
  }
}
