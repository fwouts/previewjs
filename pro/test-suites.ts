import ossTestSuites from "@previewjs/app/tests";
import { multipleComponentsTests } from "./src/tests/multiple-components.spec";
import { sidePanelTests } from "./src/tests/sidepanel.spec";
import { storiesTests } from "./src/tests/stories.spec";

const testSuites = [
  multipleComponentsTests,
  sidePanelTests,
  storiesTests,
  ...ossTestSuites,
];

export default testSuites;
