import { FrameworkPlugin } from "@previewjs/core";
import {
  arrayType,
  createTypeAnalyzer,
  EMPTY_OBJECT_TYPE,
  namedType,
  NODE_TYPE,
  NUMBER_TYPE,
  objectType,
  STRING_TYPE,
  TypeAnalyzer,
} from "@previewjs/type-analyzer";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
  Reader,
  Writer,
} from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import solidFrameworkPlugin from ".";
import { SOLID_SPECIAL_TYPES } from "./special-types";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.tsx");

describe("analyzeSolidComponent", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await solidFrameworkPlugin.create();
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: ROOT_DIR_PATH,
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
      specialTypes: SOLID_SPECIAL_TYPES,
    });
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  test("local component with named export", async () => {
    expect(
      await analyze(
        `
function A() {
  return <div>Hello, World!</div>;
}

export { A }
`,
        "A"
      )
    ).toEqual({
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    });
  });

  test("local component with named aliased export", async () => {
    expect(
      await analyze(
        `
function A() {
  return <div>Hello, World!</div>;
}

export { A as B }
`,
        "A"
      )
    ).toEqual({
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    });
  });

  test("local component with default export", async () => {
    expect(
      await analyze(
        `
export function A() {
  return <div>Hello, World!</div>;
}

export default A
`,
        "A"
      )
    ).toEqual({
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    });
  });

  test("declared function with empty props", async () => {
    expect(
      await analyze(
        `
export function A() {
  return <div>Hello, World!</div>;
}
`,
        "A"
      )
    ).toEqual({
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    });
  });

  test("declared function with typed props parameter", async () => {
    expect(
      await analyze(
        `
  export function A(props: { foo: string }) {
    return <div>Hello, World!</div>;
  };
  `,
        "A"
      )
    ).toEqual({
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      types: {},
    });
  });

  test("declared function with type alias props parameter", async () => {
    expect(
      await analyze(
        `

  type SomeProps = {
    foo: string
  };

  export function A(props: SomeProps) {
    return <div>Hello, World!</div>;
  };
  `,
        "A"
      )
    ).toEqual({
      propsType: objectType({ foo: STRING_TYPE }),
      types: {
        "App.tsx:SomeProps": {
          type: objectType({ foo: STRING_TYPE }),
          parameters: {},
        },
      },
    });
  });

  test("constant function with empty props", async () => {
    expect(
      await analyze(
        `
export const A = () => {
  return <div>Hello, World!</div>;
}
`,
        "A"
      )
    ).toEqual({
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    });
  });

  test("constant function with typed props parameter", async () => {
    expect(
      await analyze(
        `
export const A = (props: { foo: string }) => {
  return <div>Hello, World!</div>;
};
`,
        "A"
      )
    ).toEqual({
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      types: {},
    });
  });

  test("constant function with complex typed props parameter", async () => {
    expect(
      await analyze(
        `
export const A = (props: { currentTab: PanelTab, tabs: PanelTab[] }) => {
  return <div>Hello, World!</div>;
};

interface PanelTab {
  label: string;
  key: string;
  notificationCount: number;
  panel: JSX.Element;
}
`,
        "A"
      )
    ).toEqual({
      propsType: objectType({
        currentTab: namedType("App.tsx:PanelTab"),
        tabs: arrayType(namedType("App.tsx:PanelTab")),
      }),
      types: {
        ["App.tsx:PanelTab"]: {
          type: objectType({
            label: STRING_TYPE,
            key: STRING_TYPE,
            notificationCount: NUMBER_TYPE,
            panel: NODE_TYPE,
          }),
          parameters: {},
        },
      },
    });
  });

  test("constant function with Component type and no parameter", async () => {
    expect(
      await analyze(
        `
import { Component } from 'solid-js';

export const A: Component<{ foo: string }> = (props) => {
  return <div>Hello, World!</div>;
};
`,
        "A"
      )
    ).toEqual({
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      types: {},
    });
  });

  test("constant function with Component type and a parameter", async () => {
    expect(
      await analyze(
        `
import { Component } from 'solid-js';

export const A: Component<{ foo: string }> = (props) => {
  return <div>Hello, {foo}!</div>;
};
`,
        "A"
      )
    ).toEqual({
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      types: {},
    });
  });

  test("default exported function with no name", async () => {
    expect(
      await analyze(
        `
export default function() {
  return <div>Hello, World!</div>;
};
`,
        "default"
      )
    ).toEqual({
      propsType: objectType({}),
      types: {},
    });
  });

  test("default exported function with no parameter", async () => {
    expect(
      await analyze(
        `
export default function A() {
  return <div>Hello, World!</div>;
};
`,
        "default"
      )
    ).toEqual({
      propsType: objectType({}),
      types: {},
    });
  });

  test("default exported function with props", async () => {
    expect(
      await analyze(
        `
export default function A(props: { name: string }) {
  return <div>Hello, {name}!</div>;
};
`,
        "default"
      )
    ).toEqual({
      propsType: objectType({
        name: STRING_TYPE,
      }),
      types: {},
    });
  });

  test("Storybook args support", async () => {
    expect(
      await analyze(
        `
import Solid from 'solid-js';

export const A: Solid.Component<{ foo: string, bar: string }> = (props) => {
  return <div>{foo}</div>;
};
A.args = {
  foo: "Hello, World!"
};
`,
        "A"
      )
    ).toEqual({
      propsType: objectType({
        foo: STRING_TYPE,
        bar: STRING_TYPE,
      }),
      types: {},
    });
  });

  async function analyze(source: string, componentName: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    const component = (
      await frameworkPlugin.detectComponents(typeAnalyzer, [MAIN_FILE])
    ).find((c) => c.name === componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }
    if (component.info.kind === "story") {
      throw new Error(`Component ${componentName} is a story`);
    }
    return component.info.analyze();
  }
});
