import ossTestSuites from "@previewjs/app/tests";
import { multipleComponentsTests } from "./multiple-components.spec";
import { storiesTests } from "./stories.spec";

const testSuites = [multipleComponentsTests, storiesTests, ...ossTestSuites];

export default testSuites;
