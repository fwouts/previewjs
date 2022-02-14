import { runTests } from "@previewjs/app/testing";
import ossTestSuites from "@previewjs/app/tests";
import * as previewModule from "../src";
import { PersistedState } from "../src/api/persisted-state";
import { actionLogsTests } from "../src/tests/action-logs.spec";
import { multipleComponentsTests } from "../src/tests/multiple-components.spec";
import { propsEditorTests } from "../src/tests/props-editor.spec";
import { sidePanelTests } from "../src/tests/sidepanel.spec";

const TEST_STATE: PersistedState = {
  license: {
    checked: {
      timestamp: Date.now(),
      valid: true,
    },
    maskedKey: "TEST",
    token: "test",
  },
};

async function main() {
  await runTests({
    previewModule: {
      start: (options) =>
        previewModule.start({
          ...options,
          persistedStateManager: {
            get: async () => TEST_STATE,
            update: async () => TEST_STATE,
          } as any,
          ...options,
        }),
    },
    testSuites: [
      actionLogsTests,
      multipleComponentsTests,
      propsEditorTests,
      sidePanelTests,
      ...ossTestSuites,
    ],
    processArgs: process.argv,
    outputDirPath: __dirname,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
