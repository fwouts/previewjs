import { PersistedState } from "@previewjs/api";
import { SetupPreviewEnvironment } from "@previewjs/core";
import setupEnvironment from "./src";

const TEST_STATE: PersistedState = {
  // TODO: Simulate a valid license.
  license: null,
};

const setupTestEnvironment: SetupPreviewEnvironment = async (options) => ({
  ...(await setupEnvironment(options)),
  persistedStateManager: {
    get: async () => TEST_STATE,
    update: async () => TEST_STATE,
  } as any,
});

export default setupTestEnvironment;
