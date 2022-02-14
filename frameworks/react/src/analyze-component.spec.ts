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
  ANY_TYPE,
  arrayType,
  createTypeAnalyzer,
  EMPTY_OBJECT_TYPE,
  functionType,
  namedType,
  NODE_TYPE,
  NULL_TYPE,
  NUMBER_TYPE,
  objectType,
  optionalType,
  STRING_TYPE,
  unionType,
} from "@previewjs/type-analyzer";
import path from "path";
import { ReactComponent, reactFrameworkPlugin } from ".";
import { analyzeReactComponent } from "./analyze-component";
import { detectArgs } from "./args";
import { detectPropTypes } from "./prop-types";
import { REACT_SPECIAL_TYPES } from "./special-types";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.tsx");
const EMPTY_SET: ReadonlySet<string> = new Set();

describe("analyzeReactComponent", () => {
  let memoryReader: Reader & Writer;
  let typescriptAnalyzer: TypescriptAnalyzer;
  let frameworkPlugin: FrameworkPlugin<ReactComponent>;

  beforeAll(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await reactFrameworkPlugin.create();
    typescriptAnalyzer = createTypescriptAnalyzer({
      rootDirPath: ROOT_DIR_PATH,
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader(), // required for TypeScript libs, e.g. Promise
      ]),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterAll(() => {
    typescriptAnalyzer.dispose();
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
      name: "A",
      propsType: EMPTY_OBJECT_TYPE,
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: EMPTY_OBJECT_TYPE,
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: EMPTY_OBJECT_TYPE,
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: EMPTY_OBJECT_TYPE,
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: objectType({ foo: STRING_TYPE }),
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: EMPTY_OBJECT_TYPE,
      providedArgs: EMPTY_SET,
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
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
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
  panel: React.ReactNode;
}
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        currentTab: namedType("App.tsx:PanelTab"),
        tabs: arrayType(namedType("App.tsx:PanelTab")),
      }),
      providedArgs: EMPTY_SET,
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

  test("constant function with FunctionComponent type and no parameter", async () => {
    expect(
      await analyze(
        `
import { FunctionComponent } from 'react';

export const A: FunctionComponent<{ foo: string }> = (props) => {
  return <div>Hello, World!</div>;
};
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
        children: optionalType(NODE_TYPE),
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("constant function with FunctionComponent type and a parameter", async () => {
    expect(
      await analyze(
        `
import { FunctionComponent } from 'react';

export const A: FunctionComponent<{ foo: string }> = (props) => {
  return <div>Hello, {foo}!</div>;
};
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
        children: optionalType(NODE_TYPE),
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("constant function with FC type alias and no parameter", async () => {
    expect(
      await analyze(
        `
import React from 'react';

export const A: React.FC<{ foo: string }> = () => {
  return <div>Hello, World!</div>;
};
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({}),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("constant function with FC type alias and a parameter", async () => {
    expect(
      await analyze(
        `
import React from 'react';

export const A: React.FC<{ foo: string }> = (props) => {
  return <div>Hello, World!</div>;
};
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
        children: optionalType(NODE_TYPE),
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("constant function with typed props but only using few props", async () => {
    expect(
      await analyze(
        `
import React from 'react';

export const A: React.FC<Props> = ({ a: foo, c }) => {
  return <div>Hello, World!</div>;
};

type Props = {
  a: string;
  b: string;
  c: string;
}
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        a: STRING_TYPE,
        c: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {
        "App.tsx:Props": {
          type: objectType({
            a: STRING_TYPE,
            b: STRING_TYPE,
            c: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    });
  });

  test("constant function with typed props using rest props", async () => {
    expect(
      await analyze(
        `
import React from 'react';

export const A: React.FC<Props> = ({ a, ...rest }) => {
  return <div>Hello, World!</div>;
};

type Props = {
  a: string;
  b: string;
  c: string;
}
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        a: STRING_TYPE,
        b: STRING_TYPE,
        c: STRING_TYPE,
        children: optionalType(NODE_TYPE),
      }),
      providedArgs: EMPTY_SET,
      types: {
        "App.tsx:Props": {
          type: objectType({
            a: STRING_TYPE,
            b: STRING_TYPE,
            c: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    });
  });

  test("PureComponent subclass with no props", async () => {
    expect(
      await analyze(
        `
import { PureComponent } from 'react';

export class A extends PureComponent {}
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: EMPTY_OBJECT_TYPE,
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("PureComponent subclass with explicit props type", async () => {
    expect(
      await analyze(
        `
import { PureComponent } from 'react';

export class A extends PureComponent<{foo: string}> {}
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("Storybook args support", async () => {
    expect(
      await analyze(
        `
import React from 'react';

export const A: React.FC<{ foo: string, bar: string }> = (props) => {
  return <div>{foo}</div>;
};
A.args = {
  foo: "Hello, World!"
};
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        foo: STRING_TYPE,
        bar: STRING_TYPE,
        children: optionalType(NODE_TYPE),
      }),
      providedArgs: new Set(["foo"]),
      types: {},
    });
  });

  test("PropsType support", async () => {
    expect(
      await analyze(
        `
import React from 'react';
import PropTypes from 'prop-types';

export const A = ({ user, onLogin, onLogout, onCreateAccount }) => {
  return <div>Hello, World!</div>;
};
A.propTypes = {
  user: PropTypes.shape({
    foo: PropTypes.string,
    bar: PropTypes.string.isRequired,
  }).isRequired,
  impersonate: PropTypes.shape({
    foo: PropTypes.string.isRequired,
  }),
  onLogin: PropTypes.func.isRequired,
  onLogout: PropTypes.func,
};
`,
        "A"
      )
    ).toEqual({
      name: "A",
      propsType: objectType({
        user: objectType({
          foo: optionalType(unionType([NULL_TYPE, STRING_TYPE])),
          bar: STRING_TYPE,
        }),
        impersonate: optionalType(
          objectType({
            foo: STRING_TYPE,
          })
        ),
        onLogin: functionType(ANY_TYPE),
        onLogout: optionalType(functionType(ANY_TYPE)),
      }),
      providedArgs: EMPTY_SET,
      types: expect.anything(),
    });
  });

  async function analyze(source: string, componentName: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    const program = typescriptAnalyzer.analyze([MAIN_FILE]);
    const component = frameworkPlugin
      .componentDetector(program, [MAIN_FILE])
      .find((c) => c.name === componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }
    const sourceFile = program.getSourceFile(MAIN_FILE)!;
    const typeAnalyzer = createTypeAnalyzer(
      ROOT_DIR_PATH,
      program,
      {},
      REACT_SPECIAL_TYPES
    );
    return analyzeReactComponent(
      typeAnalyzer,
      component,
      detectArgs(sourceFile, component.name),
      detectPropTypes(sourceFile, component.name)
    );
  }
});
