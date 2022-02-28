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
  };
}
