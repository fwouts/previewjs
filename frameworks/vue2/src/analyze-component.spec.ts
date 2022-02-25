import { FrameworkPlugin } from "@previewjs/core";
import {
  createTypescriptAnalyzer,
  TypescriptAnalyzer,
} from "@previewjs/core/ts-helpers";
import {
  createTypeAnalyzer,
  literalType,
  NUMBER_TYPE,
  objectType,
  optionalType,
  STRING_TYPE,
  unionType,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
  Reader,
  Writer,
} from "@previewjs/vfs";
import path from "path";
import { vue2FrameworkPlugin } from ".";
import { analyzeVueComponentFromTemplate } from "./analyze-component";
import { createVueTypeScriptReader } from "./vue-reader";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.vue");
const EMPTY_SET: ReadonlySet<string> = new Set();

describe("analyze Vue 2 component", () => {
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

  test("export default {} with object props", async () => {
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
    a: String,
    b: { type: String },
    c: { type: String, default: "foo" },
    d: { type: String, required: true },
    e: { type: String, default: "foo", required: false },
    f: [String, Number],
    g: { type: [String, Number], default: "foo" },
    h: { type: [String, Number], required: true },
    i: { type: [String, Number], default: "foo", required: false },
  }
}
</script>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        a: optionalType(STRING_TYPE),
        b: optionalType(STRING_TYPE),
        c: optionalType(STRING_TYPE),
        d: STRING_TYPE,
        e: optionalType(STRING_TYPE),
        f: optionalType(unionType([STRING_TYPE, NUMBER_TYPE])),
        g: optionalType(unionType([STRING_TYPE, NUMBER_TYPE])),
        h: unionType([STRING_TYPE, NUMBER_TYPE]),
        i: optionalType(unionType([STRING_TYPE, NUMBER_TYPE])),
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("export default {} with array props", async () => {
    expect(
      await analyze(
        `
<template>
  <div>{{ label }}</div>
</template>
<script>
export default {
  name: "App",
  props: ["a", "b", "c"]
}
</script>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        a: UNKNOWN_TYPE,
        b: UNKNOWN_TYPE,
        c: UNKNOWN_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("export default class with vue-property-decorator", async () => {
    expect(
      await analyze(
        `
<template>
  <div :class="\`size-\${size}\`">{{ label }}</div>
</template>
<script>
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';

type Size = "default" | "small" | "big";

@Component
export default class App extends Vue {
  @Prop({ type: String, required: true }) readonly label;
  @Prop({ type: String, default: 'default' }) readonly size!: Size;
}
</script>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        label: STRING_TYPE,
        size: optionalType(
          unionType([
            literalType("default"),
            literalType("small"),
            literalType("big"),
          ])
        ),
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    return analyzeVueComponentFromTemplate(
      typescriptAnalyzer,
      (program) => createTypeAnalyzer(ROOT_DIR_PATH, program, {}, {}),
      MAIN_FILE
    );
  }
});
