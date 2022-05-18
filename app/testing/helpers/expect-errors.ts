import { AppController } from "./app-controller";
import { expect } from "./expect";

export async function expectErrors(
  controller: AppController,
  errors: Array<string | string[]>
) {
  const selectedTab = await controller.bottomPanel.tabs.selected();
  const isConsoleSelected =
    (await selectedTab?.text())?.includes("Console") || false;
  if (errors.length === 0) {
    await controller.console.notificationCount.waitUntilGone();
    if (!isConsoleSelected) {
      await controller.bottomPanel.tabs.get("Console").click();
    }
    expect(await controller.console.items.count()).toEqual(0);
  } else {
    await controller.console.notificationCount.waitUntilVisible();
    expect(await controller.console.notificationCount.text()).toEqual(
      errors.length.toString(10)
    );
    if (!isConsoleSelected) {
      await controller.bottomPanel.tabs.get("Console").click();
    }
    expect(await controller.console.items.count()).toEqual(errors.length);
    for (let i = 0; i < errors.length; i++) {
      const errorLog = await controller.console.items.at(i);
      await errorLog.waitUntilVisible();
      let error = errors[i]!;
      if (!Array.isArray(error)) {
        error = [error];
      }
      for (const errorPart of error) {
        expect(await errorLog.text()).toContain(errorPart);
      }
    }
  }
}
