import { createTypeAnalyzer, TypeAnalyzer } from "@previewjs/type-analyzer";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import type { Reader, Writer } from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSvelteTypeScriptReader } from "./svelte-reader";

describe.concurrent("createSvelteTypeScriptReader", () => {
  let memoryReader: Reader & Writer;
  let reader: Reader;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(() => {
    memoryReader = createMemoryReader();
    reader = createSvelteTypeScriptReader(memoryReader);
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: path.join(__dirname, "virtual"),
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader(), // required for TypeScript libs, e.g. Promise
      ]),
      specialTypes: {},
    });
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  it("extracts from script", async () => {
    memoryReader.updateFile(
      path.join(__dirname, "virtual", "App.svelte"),
      `
<script lang="ts">
  import logo from './assets/svelte.png'
  import Counter from './lib/Counter.svelte'
</script>

<main>
  <img src={logo} alt="Svelte Logo" />
  <h1>Hello Typescript!</h1>
  <Counter />
</main>
    `
    );
    const virtualFile = await reader.read(
      path.join(__dirname, "virtual", "App.svelte.ts")
    );
    if (virtualFile?.kind !== "file") {
      throw new Error();
    }
    expect(await virtualFile.read()).toEqual(`
  import logo from './assets/svelte.png'
  import Counter from './lib/Counter.svelte'
`);
  });

  // TODO: Add a test to ensure that module scripts are ignored.
});
