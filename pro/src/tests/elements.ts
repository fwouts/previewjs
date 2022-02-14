import { AppController } from "@previewjs/app/testing/helpers/app-controller";

export function elements(controller: AppController) {
  return {
    component: {
      get: (label: string) => {
        return controller.element(
          `xpath=//*[contains(@class, 'component')][contains(., '${label}')]`
        );
      },
    },

    sidePanel: {
      toggle: controller.element(".sidepanel-toggle"),
      dir: {
        get: (label: string) => {
          return controller.element(
            `xpath=//div[contains(@class, 'directory')][contains(., '${label}')]`
          );
        },
      },
      file: {
        get: (label: string) => {
          return controller.element(
            `xpath=//div[contains(@class, 'file')][contains(., '${label}')]`
          );
        },
        selected: () => {
          return controller.element("#selected-file");
        },
      },
    },
  };
}
