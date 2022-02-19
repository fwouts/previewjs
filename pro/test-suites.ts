import ossTestSuites from "@previewjs/app/tests";
import { multipleComponentsTests } from "./src/tests/multiple-components.spec";
import { sidePanelTests } from "./src/tests/sidepanel.spec";

const testSuites = [multipleComponentsTests, sidePanelTests, ...ossTestSuites];

export default testSuites;
