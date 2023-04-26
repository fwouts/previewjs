import { decodeComponentId } from "@previewjs/api";
import type { FrameworkPlugin } from "@previewjs/core";
import {
  ANY_TYPE,
  createTypeAnalyzer,
  NUMBER_TYPE,
  objectType,
  optionalType,
  TypeAnalyzer,
} from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import svelteFrameworkPlugin from ".";
import { inferComponentNameFromSveltePath } from "./infer-component-name";
import { createSvelteTypeScriptReader } from "./svelte-reader";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.svelte");

describe.concurrent("analyze Svelte component", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await svelteFrameworkPlugin.create({
      rootDirPath: ROOT_DIR_PATH,
      dependencies: {},
    });
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: ROOT_DIR_PATH,
      reader: createSvelteTypeScriptReader(
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

  test("no props", async () => {
    expect(
      await analyze(
        `
<script lang="ts">
  const increment = () => {
    count += 1;
  };
</script>

<button on:click={increment}>
  Hello, World!
</button>
`
      )
    ).toEqual({
      propsType: objectType({}),
      types: {},
    });
  });

  test("props without type", async () => {
    expect(
      await analyze(
        `
<script lang="ts">
  export let count;
  const increment = () => {
    count += 1;
  };
</script>

<button on:click={increment}>
  {count}
</button>
`
      )
    ).toEqual({
      propsType: objectType({
        count: ANY_TYPE,
      }),
      types: {},
    });
  });

  test("props without default", async () => {
    expect(
      await analyze(
        `
<script lang="ts">
  export let count: number;
  const increment = () => {
    count += 1;
  };
</script>

<button on:click={increment}>
  {count}
</button>
`
      )
    ).toEqual({
      propsType: objectType({
        count: NUMBER_TYPE,
      }),
      types: {},
    });
  });

  test("props with default", async () => {
    expect(
      await analyze(
        `
<script lang="ts">
  export let count = 12;
  const increment = () => {
    count += 1;
  };
</script>

<button on:click={increment}>
  {count}
</button>
`
      )
    ).toEqual({
      propsType: objectType({
        count: optionalType(NUMBER_TYPE),
      }),
      types: {},
    });
  });

  test("readonly props", async () => {
    expect(
      await analyze(
        `
<script lang="ts">
  export const count = 12;
  const increment = () => {
    count += 1;
  };
</script>

<button on:click={increment}>
  {count}
</button>
`
      )
    ).toEqual({
      propsType: objectType({}),
      types: {},
    });
  });

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    const componentName = inferComponentNameFromSveltePath(MAIN_FILE);
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
