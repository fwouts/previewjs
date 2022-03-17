import ossTestSuites from "@previewjs/app/tests";
import { multipleComponentsTests } from "./multiple-components.spec";

const testSuites = [multipleComponentsTests, ...ossTestSuites];

export default testSuites;
