import { decodeComponentId } from "@previewjs/api";
import type { FrameworkPlugin } from "@previewjs/core";
import {
  createTypeAnalyzer,
  literalType,
  NUMBER_TYPE,
  objectType,
  optionalType,
  STRING_TYPE,
  TypeAnalyzer,
  unionType,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import vue2FrameworkPlugin from ".";
import { inferComponentNameFromVuePath } from "./infer-component-name.js";
import { createVueTypeScriptReader } from "./vue-reader.js";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.vue");

describe.concurrent("analyze Vue 2 component", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await vue2FrameworkPlugin.create({
      rootDirPath: ROOT_DIR_PATH,
      dependencies: {},
    });
    typeAnalyzer = createTypeAnalyzer({
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

  afterEach(() => {
    typeAnalyzer.dispose();
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
      propsType: objectType({}),
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

  props: ["a", "b", "c"]
}
</script>
`
      )
    ).toEqual({
      propsType: objectType({
        a: UNKNOWN_TYPE,
        b: UNKNOWN_TYPE,
        c: UNKNOWN_TYPE,
      }),
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
      types: {},
    });
  });

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    const componentName = inferComponentNameFromVuePath(MAIN_FILE);
    const component = (
      await frameworkPlugin.detectComponents(memoryReader, typeAnalyzer, [
        MAIN_FILE,
      ])
    ).find((c) => decodeComponentId(c.componentId).name === componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }
    if (component.info.kind === "story") {
      throw new Error(`Component ${componentName} is a story`);
    }
    return component.info.analyze();
  }
});
