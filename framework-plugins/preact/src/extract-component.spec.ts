import type { FrameworkPlugin } from "@previewjs/core";
import { object, string, TRUE } from "@previewjs/serializable-values";
import { objectType, STRING_TYPE } from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import url from "url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import reactFrameworkPlugin from ".";
import { extractPreactComponents } from "./extract-component.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = path.join(__dirname, "virtual");
const APP_TSX = path.join(ROOT_DIR, "App.tsx");
const APP_STORIES_TSX = path.join(ROOT_DIR, "App.stories.tsx");

describe("extractPreactComponents", () => {
  const logger = createLogger(
    { level: "debug" },
    prettyLogger({ colorize: true })
  );

  let memoryReader: Reader & Writer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      APP_TSX,
      "export default ({ label }: { label: string }) => <div>{label}</div>;"
    );
    frameworkPlugin = await reactFrameworkPlugin.create({
      rootDirPath: ROOT_DIR,
      dependencies: {},
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
      logger,
    });
  });

  afterEach(() => {
    frameworkPlugin.dispose();
  });

  it("detects expected components", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
import { ComponentType, FunctionComponent, Component } from 'preact';
import { forwardRef } from 'preact/compat';

function wrapComponent<P>(c: ComponentType<P>): ComponentType<P> {
  return c;
}

function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;

// Note: this isn't detected as of October 2021.
const HocComponent = wrapComponent(() => <div>Hello, World!</div>);

class ClassComponent1 extends Component {}

const ForwardRef = forwardRef((props, ref) => <ConstantFunction {...props} />);

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
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:DeclaredFunction",
        kind: "component",
        exported: false,
      },
      {
        componentId: "App.tsx:ConstantFunction",
        kind: "component",
        exported: false,
      },
      // Note: this isn't detected as of October 2021.
      // {
      //   name: "HocComponent",
      //   exported: false,
      //   offsets: expect.anything(),
      // },
      {
        componentId: "App.tsx:ClassComponent1",
        kind: "component",
        exported: false,
      },
      {
        componentId: "App.tsx:ForwardRef",
        kind: "component",
        exported: false,
      },
      {
        componentId: "App.tsx:NotObjectProps",
        kind: "component",
        exported: true,
      },
      {
        componentId: "App.tsx:MissingType",
        kind: "component",
        exported: true,
      },
    ]);
  });

  it("detects components without any React import", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:DeclaredFunction",
        kind: "component",
        exported: false,
      },
      {
        componentId: "App.tsx:ConstantFunction",
        kind: "component",
        exported: false,
      },
    ]);
  });

  it("ignores default export of identifier", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
const A = () => {
  return <div>Hello, World!</div>;
};

export default A;
`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:A",
        kind: "component",
        exported: true,
      },
    ]);
  });

  it("detects default export component (arrow function)", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default () => {
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:default",
        kind: "component",
        exported: true,
      },
    ]);
  });

  it("detects default export component (named function)", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default function test(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:test",
        kind: "component",
        exported: true,
      },
    ]);
  });

  it("detects default export component (anonymous function)", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default function(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:default",
        kind: "component",
        exported: true,
      },
    ]);
  });

  it("does not detect default export non-component", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default () => {
  return "foo";
}
`
    );
    expect(extract(APP_TSX)).toMatchObject([]);
  });

  it("detects CSF1 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import Button from "./App";

export default {
  component: Button
}

export const Primary = () => <Button primary label="Button" />;

export const NotStory = (props) => <Button {...props} />;
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Primary",
        kind: "story",
        args: null,
        associatedComponent: {
          componentId: "App.tsx:default",
        },
      },
      {
        componentId: "App.stories.tsx:NotStory",
        kind: "component",
        exported: true,
      },
    ]);
    const storyInfo = extractedStories[0];
    if (storyInfo?.kind !== "story" || !storyInfo.associatedComponent) {
      throw new Error();
    }
    expect(await storyInfo.associatedComponent.extractProps()).toEqual({
      props: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF1 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import Button from "./App";

export default {
  title: "Stories"
}

export const Primary = () => <Button primary label="Button" />;

export const NotStory = (props) => <Button {...props} />;
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Primary",
        kind: "story",
        args: null,
        associatedComponent: null,
      },
      {
        componentId: "App.stories.tsx:NotStory",
        kind: "component",
        exported: true,
      },
    ]);
  });

  it("detects CSF2 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import Button from "./App";

export default {
  title: "Stories"
}

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
   primary: true,
   label: 'Button',
};
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Template",
        kind: "component",
        exported: false,
      },
      {
        componentId: "App.stories.tsx:Primary",
        kind: "story",
        args: {
          value: object([
            {
              kind: "key",
              key: string("primary"),
              value: TRUE,
            },
            {
              kind: "key",
              key: string("label"),
              value: string("Button"),
            },
          ]),
        },
        associatedComponent: null,
      },
    ]);
  });

  it("detects CSF3 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
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

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Example",
        kind: "story",
        args: {
          value: object([
            {
              kind: "key",
              key: string("label"),
              value: string("Hello, World!"),
            },
          ]),
        },
        associatedComponent: {
          componentId: "App.tsx:default",
        },
      },
      {
        componentId: "App.stories.tsx:NoArgs",
        kind: "story",
        args: null,
        associatedComponent: {
          componentId: "App.tsx:default",
        },
      },
    ]);
    const storyInfo = extractedStories[0];
    if (storyInfo?.kind !== "story" || !storyInfo.associatedComponent) {
      throw new Error();
    }
    expect(await storyInfo.associatedComponent.extractProps()).toEqual({
      props: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF3 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import Button from "./App";

export default {
  title: "Stories"
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

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Example",
        kind: "story",
        args: {
          value: object([
            {
              kind: "key",
              key: string("label"),
              value: string("Hello, World!"),
            },
          ]),
        },
        associatedComponent: null,
      },
      {
        componentId: "App.stories.tsx:NoArgs",
        kind: "story",
        args: null,
        associatedComponent: null,
      },
    ]);
  });

  function extract(absoluteFilePath: string) {
    return extractPreactComponents(
      logger,
      frameworkPlugin.typeAnalyzer.analyze([absoluteFilePath]),
      ROOT_DIR,
      absoluteFilePath
    );
  }
});
