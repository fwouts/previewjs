import { decodePreviewableId } from "@previewjs/analyzer-api";
import type { FrameworkPlugin } from "@previewjs/core";
import {
  ANY_TYPE,
  NUMBER_TYPE,
  objectType,
  optionalType,
} from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import svelteFrameworkPlugin from ".";
import { inferComponentNameFromSveltePath } from "./infer-component-name";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.svelte");

describe("analyze Svelte component", () => {
  let memoryReader: Reader & Writer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await svelteFrameworkPlugin.create({
      rootDir: ROOT_DIR_PATH,
      dependencies: {},
      reader: createStackedReader([
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
      ]),
      logger: createLogger(
        { level: "debug" },
        prettyLogger({ colorize: true })
      ),
    });
  });

  afterEach(() => {
    frameworkPlugin.dispose();
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
      props: objectType({}),
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
      props: objectType({
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
      props: objectType({
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
      props: objectType({
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
      props: objectType({}),
      types: {},
    });
  });

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    const componentName = inferComponentNameFromSveltePath(MAIN_FILE);
    const component = (
      await frameworkPlugin.analyze([MAIN_FILE])
    ).components.find((c) => decodePreviewableId(c.id).name === componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }
    return component.extractProps();
  }
});
