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
import path from "path";
import { reactFrameworkPlugin } from ".";
import { extractReactComponents } from "./extract-component";

const MAIN_FILE = path.join(__dirname, "virtual", "App.tsx");

describe("extractReactComponents", () => {
  let memoryReader: Reader & Writer;
  let typescriptAnalyzer: TypescriptAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    const frameworkPlugin = await reactFrameworkPlugin.create();
    typescriptAnalyzer = createTypescriptAnalyzer({
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
    typescriptAnalyzer.dispose();
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
      // Note: this isn't detected as of October 2021.
      // {
      //   name: "HocComponent",
      //   exported: false,
      //   offsets: expect.anything(),
      // },
      {
        name: "ClassComponent1",
        exported: false,
      },
      {
        name: "ClassComponent2",
        exported: false,
      },
      {
        name: "ForwardRef",
        exported: false,
      },
      {
        name: "NextComponent",
        exported: false,
      },
      {
        name: "Pure",
        exported: true,
      },
      {
        name: "NotObjectProps",
        exported: true,
      },
      {
        name: "MissingType",
        exported: true,
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

  function extract(source: string) {
    const rootDirPath = path.join(__dirname, "virtual");
    memoryReader.updateFile(path.join(rootDirPath, "App.tsx"), source);
    return extractReactComponents(
      typescriptAnalyzer.analyze([MAIN_FILE]),
      MAIN_FILE
    );
  }
});
