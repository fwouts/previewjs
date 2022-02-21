import { FrameworkPlugin } from "@previewjs/core";
import {
  createTypescriptAnalyzer,
  TypescriptAnalyzer,
} from "@previewjs/core/ts-helpers";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
  Reader,
  Writer,
} from "@previewjs/core/vfs";
import {
  createTypeAnalyzer,
  objectType,
  optionalType,
  STRING_TYPE,
} from "@previewjs/type-analyzer";
import path from "path";
import { vue2FrameworkPlugin } from ".";
import { analyzeVueComponentFromTemplate } from "./analyze-component";
import { createVueTypeScriptReader } from "./vue-reader";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.vue");
const EMPTY_SET: ReadonlySet<string> = new Set();

describe("analyzeReactComponent", () => {
  let memoryReader: Reader & Writer;
  let typescriptAnalyzer: TypescriptAnalyzer;
  let frameworkPlugin: FrameworkPlugin;

  beforeAll(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await vue2FrameworkPlugin.create();
    typescriptAnalyzer = createTypescriptAnalyzer({
      rootDirPath: ROOT_DIR_PATH,
      reader: createVueTypeScriptReader(
        createStackedReader([
          memoryReader,
          createFileSystemReader({
            watch: false,
          }), // required for TypeScript libs, e.g. Promise
          createFileSystemReader({
            mapping: {
              from: path.join(__dirname, "..", "preview", "modules"),
              to: path.join(ROOT_DIR_PATH, "node_modules"),
            },
            watch: false,
          }),
        ])
      ),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterAll(() => {
    typescriptAnalyzer.dispose();
  });

  test("export default {} without props", async () => {
    expect(
      await analyze(
        `
<template>
  <div>{{ label }}</div>
</template>
<script>
export default {
  name: "App"
}
</script>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({}),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test.only("export default {} with object props", async () => {
    expect(
      await analyze(
        `
<template>
  <div>{{ label }}</div>
</template>
<script>
export default {
  name: "App",
  props: {
    foo: String,
    bar: { type: String, required: true },
  }
}
</script>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: optionalType(STRING_TYPE),
        bar: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  // TODO: array props
  // TODO: union types

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    return analyzeVueComponentFromTemplate(
      typescriptAnalyzer,
      (program) => createTypeAnalyzer(ROOT_DIR_PATH, program, {}, {}),
      MAIN_FILE
    );
  }
});
