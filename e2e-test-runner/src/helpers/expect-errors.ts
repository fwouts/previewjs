import type { AppController } from "./app-controller";
import { expect } from "./expect";

export async function expectErrors(
  controller: AppController,
  options: {
    fullscreen: boolean;
  },
  expectedErrors: Array<string | string[]>
) {
  await controller.waitForIdle();
  await controller.waitForExpectedIframeRefresh();
  const selectedTab = await controller.bottomPanel.tabs.selected();
  const consoleTab = controller.bottomPanel.tabs.get("Console");
  const isConsoleSelected =
    (await selectedTab.text())?.includes("Console") || false;
  if (expectedErrors.length === 0) {
    await controller.console.notificationCount.waitUntilGone();
  }
  if (!isConsoleSelected && (await consoleTab.visible())) {
    await consoleTab.click();
  }
  if (expectedErrors.length === 0) {
    expect(await controller.fullscreenRenderingError.waitUntilGone());
    expect(await controller.console.items.count()).toEqual(0);
  } else {
    if (options.fullscreen) {
      expect(await controller.fullscreenRenderingError.waitUntilVisible());
    } else {
      expect(await controller.fullscreenRenderingError.waitUntilGone());
    }
    const itemCount = await controller.console.items.count();
    const actualErrors: string[] = [];
    for (let i = 0; i < itemCount; i++) {
      const errorLog = await controller.console.items.at(i);
      if (!(await errorLog.className()).includes("console-item-error")) {
        continue;
      }
      actualErrors.push((await errorLog.text()) || "");
    }
    const availableIndices = new Set(Array(actualErrors.length).keys());
    if (expectedErrors.length !== actualErrors.length) {
      throw new Error(
        `Expected errors:\n${JSON.stringify(
          expectedErrors,
          null,
          2
        )}\n\nActual errors:\n${JSON.stringify(actualErrors, null, 2)}`
      );
    }
    for (let expectedError of expectedErrors) {
      if (!Array.isArray(expectedError)) {
        expectedError = [expectedError];
      }
      let foundIndex = false;
      for (const i of availableIndices) {
        const actualError = actualErrors[i]!;
        let matches = true;
        for (const expectedErrorPart of expectedError) {
          if (!actualError.includes(expectedErrorPart)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          foundIndex = true;
          availableIndices.delete(i);
          break;
        }
      }
      if (!foundIndex) {
        throw new Error(
          `No match for: ${JSON.stringify(
            expectedError
          )}\n\nActual errors:\n${JSON.stringify(actualErrors, null, 2)}`
        );
      }
    }
    if (await consoleTab.visible()) {
      expect(await controller.console.notificationCount.text()).toEqual(
        expectedErrors.length.toString(10)
      );
    }
  }
}
