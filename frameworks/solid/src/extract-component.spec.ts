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
import { solidFrameworkPlugin } from ".";
import { extractSolidComponents } from "./extract-component";

const MAIN_FILE = path.join(__dirname, "virtual", "App.tsx");

describe("extractSolidComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    const frameworkPlugin = await solidFrameworkPlugin.create();
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

  it("detects expected components", async () => {
    expect(
      extract(`
import type { Component } from 'solid-js';

const Component1: Component = () => {
  return <div>Hello, World!</div>;
};

const Component2 = () => {
  return <div>Hello, World!</div>;
};

function Component3() {
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
      {
        name: "Component3",
        exported: false,
        isStory: false,
      },
    ]);
  });

  it("detects components without any Solid import", async () => {
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
    return extractSolidComponents(typeAnalyzer.analyze([MAIN_FILE]), MAIN_FILE);
  }
});
