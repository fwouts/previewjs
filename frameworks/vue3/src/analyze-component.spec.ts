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
  STRING_TYPE,
} from "@previewjs/type-analyzer";
import path from "path";
import { vue3FrameworkPlugin } from ".";
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
    frameworkPlugin = await vue3FrameworkPlugin.create();
    typescriptAnalyzer = createTypescriptAnalyzer({
      rootDirPath: ROOT_DIR_PATH,
      reader: createVueTypeScriptReader(
        createStackedReader([
          memoryReader,
          createFileSystemReader({
            watch: false,
          }), // required for TypeScript libs, e.g. Promise
        ])
      ),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterAll(() => {
    typescriptAnalyzer.dispose();
  });

  test("basic props", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
defineProps<{ msg: string }>();
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        msg: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    const program = typescriptAnalyzer.analyze([MAIN_FILE + ".ts"]);
    // for (const d of program.getSemanticDiagnostics()) {
    //   console.error(d.messageText);
    // }
    const typeAnalyzer = createTypeAnalyzer(ROOT_DIR_PATH, program, {}, {});
    return analyzeVueComponentFromTemplate(typeAnalyzer, MAIN_FILE + ".ts");
  }
});
