import ossTestSuites from "@previewjs/app/tests";
import { multipleComponentsTests } from "./src/tests/multiple-components.spec";
import { storiesTests } from "./src/tests/stories.spec";

const testSuites = [multipleComponentsTests, storiesTests, ...ossTestSuites];

export default testSuites;
