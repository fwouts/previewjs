import { object, string, TRUE } from "@previewjs/serializable-values";
import {
  createTypeAnalyzer,
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
import url from "url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractReactComponents } from "./extract-component.js";
import reactFrameworkPlugin from "./index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR, "App.tsx");
const STORIES_FILE = path.join(ROOT_DIR, "App.stories.tsx");

describe.concurrent("extractReactComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      MAIN_FILE,
      "export default ({ label }: { label: string }) => <div>{label}</div>;"
    );
    const frameworkPlugin = await reactFrameworkPlugin.create({
      rootDirPath: ROOT_DIR,
      dependencies: {},
    });
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: ROOT_DIR,
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
    memoryReader.updateFile(
      MAIN_FILE,
      `
import React, { Component, PureComponent } from "react";

function wrapComponent<P>(c: React.ComponentType<P>): React.ComponentType<P> {
  return c;
}

function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;

// Note: this isn't detected as of October 2021.
const HocComponent = wrapComponent(() => <div>Hello, World!</div>);

class ClassComponent1 extends React.Component {}

class ClassComponent2 extends Component {}

const ForwardRef = React.forwardRef((props, ref) => <ConstantFunction {...props} />);

const NextComponent: NextPage = () => {
  return <div>Hello, World!</div>;
};

export class Pure extends PureComponent<{foo: string}> {}

export class BaseClass<T> {}

export class NotComponentClass extends BaseClass<SomeProps> {}

export const NotObjectProps = (props: () => void) => {
  return <div>Hello, World!</div>;
};

export const MissingType = (props) => {
  return <div>Hello, World!</div>;
};

export const NotComponent = () => {
  // This isn't a component.
};

export const NotComponentEither = () => {
  return "Hello";
};

export const AlsoNotAStory = {
  args: {}
};
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
      {
        name: "DeclaredFunction",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "ConstantFunction",
        info: {
          kind: "component",
          exported: false,
        },
      },
      // Note: this isn't detected as of October 2021.
      // {
      //   name: "HocComponent",
      //   exported: false,
      //   offsets: expect.anything(),
      // },
      {
        name: "ClassComponent1",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "ClassComponent2",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "ForwardRef",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "NextComponent",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "Pure",
        info: {
          kind: "component",
          exported: true,
        },
      },
      {
        name: "NotObjectProps",
        info: {
          kind: "component",
          exported: true,
        },
      },
      {
        name: "MissingType",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects components without any React import", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
      {
        name: "DeclaredFunction",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "ConstantFunction",
        info: {
          kind: "component",
          exported: false,
        },
      },
    ]);
  });

  it("ignores default export of identifier", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
const A = () => {
  return <div>Hello, World!</div>;
};

export default A;
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
      {
        name: "A",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects default export component (arrow function)", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export default () => {
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
      {
        name: "default",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects default export component (named function)", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export default function test(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
      {
        name: "test",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects default export component (anonymous function)", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export default function(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
      {
        name: "default",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("does not detect default export non-component", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export default () => {
  return "foo";
}
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([]);
  });

  it("detects CSF2 stories", async () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import Button from "./App";

export default {
  component: Button
}

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
   primary: true,
   label: 'Button',
};
`
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        name: "Template",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "Primary",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("primary"),
                value: TRUE,
              },
              {
                key: string("label"),
                value: string("Button"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "default",
          },
        },
      },
    ]);
    if (extractedStories[1]?.info.kind !== "story") {
      throw new Error();
    }
    expect(
      await extractedStories[1].info.associatedComponent.analyze()
    ).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF3 stories", async () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import Button from "./App";

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
`
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "default",
          },
        },
      },
      {
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "default",
          },
        },
      },
    ]);
    if (extractedStories[0]?.info.kind !== "story") {
      throw new Error();
    }
    expect(
      await extractedStories[0].info.associatedComponent.analyze()
    ).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  function extract(absoluteFilePath: string) {
    return extractReactComponents(
      typeAnalyzer.analyze([absoluteFilePath]),
      absoluteFilePath
    );
  }
});
