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
import { reactFrameworkPlugin } from ".";
import { extractReactComponents } from "./extract-component";

const MAIN_FILE = path.join(__dirname, "virtual", "App.tsx");

describe("extractReactComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    const frameworkPlugin = await reactFrameworkPlugin.create();
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
`)
    ).toMatchObject([
      {
        name: "DeclaredFunction",
        exported: false,
        isStory: false,
      },
      {
        name: "ConstantFunction",
        exported: false,
        isStory: false,
      },
      // Note: this isn't detected as of October 2021.
      // {
      //   name: "HocComponent",
      //   exported: false,
      //   offsets: expect.anything(),
      // },
      {
        name: "ClassComponent1",
        exported: false,
        isStory: false,
      },
      {
        name: "ClassComponent2",
        exported: false,
        isStory: false,
      },
      {
        name: "ForwardRef",
        exported: false,
        isStory: false,
      },
      {
        name: "NextComponent",
        exported: false,
        isStory: false,
      },
      {
        name: "Pure",
        exported: true,
        isStory: false,
      },
      {
        name: "NotObjectProps",
        exported: true,
        isStory: false,
      },
      {
        name: "MissingType",
        exported: true,
        isStory: false,
      },
    ]);
  });

  it("detects components without any React import", async () => {
    expect(
      extract(`
function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`)
    ).toMatchObject([
      {
        name: "DeclaredFunction",
        exported: false,
      },
      {
        name: "ConstantFunction",
        exported: false,
      },
    ]);
  });

  it("ignores default export of identifier", async () => {
    expect(
      extract(`
const A = () => {
  return <div>Hello, World!</div>;
};

export default A;
`)
    ).toMatchObject([
      {
        name: "A",
        exported: true,
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
        name: "test",
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

  it("does not detect default export non-component", async () => {
    expect(
      extract(`
export default () => {
  return "foo";
}
`)
    ).toMatchObject([]);
  });

  it("detects CSF2 stories", async () => {
    expect(
      extract(`
import Button from "./Button";

export default {
  component: Button
}

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
   primary: true,
   label: 'Button',
};
`)
    ).toMatchObject([
      {
        name: "Template",
        exported: false,
        isStory: false,
      },
      {
        name: "Primary",
        exported: true,
        isStory: true,
      },
    ]);
  });

  it("detects CSF3 stories", async () => {
    expect(
      extract(`
import Button from "./Button";

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
    return extractReactComponents(typeAnalyzer.analyze([MAIN_FILE]), MAIN_FILE);
  }
});
