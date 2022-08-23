import { createTypeAnalyzer, TypeAnalyzer } from "@previewjs/type-analyzer";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
  Reader,
  Writer,
} from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vue2FrameworkPlugin } from ".";
import { extractVueComponents } from "./extract-component";

const MAIN_FILE = path.join(__dirname, "virtual", "App.tsx");

describe("extractVueComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    const frameworkPlugin = await vue2FrameworkPlugin.create();
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: path.join(__dirname, "virtual"),
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  it.only("detects expected components", async () => {
    expect(
      extract(`
const Component1 = () => {
  return <div>Hello, World!</div>;
};

function Component2() {
  return <div>Hello, World!</div>;
};

export const NotAStory = {
  args: {}
};

export default Component1;
      
`)
    ).toMatchObject([
      {
        name: "Component1",
        exported: true,
        isStory: false,
      },
      {
        name: "Component2",
        exported: false,
        isStory: false,
      },
    ]);
  });

  it("detects components without any Vue import", async () => {
    expect(
      extract(`
export function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`)
    ).toMatchObject([
      {
        name: "DeclaredFunction",
        exported: true,
        isStory: false,
      },
      {
        name: "ConstantFunction",
        exported: false,
        isStory: false,
      },
    ]);
  });

  it("detects default export component (arrow function)", async () => {
    expect(
      extract(`
export default () => {
  return <div>Hello, World!</div>;
}
`)
    ).toMatchObject([
      {
        name: "default",
        exported: true,
      },
    ]);
  });

  it("detects default export component (named function)", async () => {
    expect(
      extract(`
export default function test(){
  return <div>Hello, World!</div>;
}
`)
    ).toMatchObject([
      {
        name: "default",
        exported: true,
      },
    ]);
  });

  it("detects default export component (anonymous function)", async () => {
    expect(
      extract(`
export default function(){
  return <div>Hello, World!</div>;
}
`)
    ).toMatchObject([
      {
        name: "default",
        exported: true,
      },
    ]);
  });

  it("detects CSF3 stories", async () => {
    expect(
      extract(`
export default {
  component: Button
}
export const Example = {
  args: {
    label: "Hello, World!"
  }
}
export const NoArgs = {}
export function NotStory() {}
`)
    ).toMatchObject([
      {
        name: "Example",
        exported: true,
        isStory: true,
      },
      {
        name: "NoArgs",
        exported: true,
        isStory: true,
      },
    ]);
  });

  function extract(source: string) {
    const rootDirPath = path.join(__dirname, "virtual");
    memoryReader.updateFile(path.join(rootDirPath, "App.tsx"), source);
    return extractVueComponents(typeAnalyzer.analyze([MAIN_FILE]), MAIN_FILE);
  }
});
