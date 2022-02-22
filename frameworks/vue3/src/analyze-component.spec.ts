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
  BOOLEAN_TYPE,
  createTypeAnalyzer,
  objectType,
  optionalType,
  STRING_TYPE,
} from "@previewjs/type-analyzer";
import path from "path";
import { vue3FrameworkPlugin } from ".";
import { analyzeVueComponentFromTemplate } from "./analyze-component";
import { createVueTypeScriptReader } from "./vue-reader";

const ROOT_DIR_PATH = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR_PATH, "App.vue");
const EMPTY_SET: ReadonlySet<string> = new Set();

describe("analyze Vue 3 component", () => {
  let memoryReader: Reader & Writer;
  let typescriptAnalyzer: TypescriptAnalyzer;
  let frameworkPlugin: FrameworkPlugin;

  beforeAll(async () => {
    memoryReader = createMemoryReader();
    frameworkPlugin = await vue3FrameworkPlugin.create();
    typescriptAnalyzer = createTypescriptAnalyzer({
      rootDirPath: ROOT_DIR_PATH,
      reader: createVueTypeScriptReader(
        createStackedReader([
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
        ])
      ),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterAll(() => {
    typescriptAnalyzer.dispose();
  });

  test("defineProps<Props>()", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
defineProps<{ foo: string }>();
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("withDefaults(defineProps<Props>(), ...)", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
withDefaults(defineProps<{ foo: string, bar: string }>(), {
  foo: "hello"
});
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: optionalType(STRING_TYPE),
        bar: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("const props = defineProps<Props>()", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
const props = defineProps<{ foo: string }>();
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("const props = withDefaults(defineProps<Props>(), ...)", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
const props = withDefaults(defineProps<{ foo: string, bar: string }>(), {
  foo: "hello"
});
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: optionalType(STRING_TYPE),
        bar: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("props = defineProps<Props>()", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
let props;
props = defineProps<{ foo: string }>();
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("props = withDefaults(defineProps<Props>(), ...)", async () => {
    expect(
      await analyze(
        `
<script setup lang="ts">
let props;
props = withDefaults(defineProps<{ foo: string, bar: string }>(), {
  foo: "hello"
});
</script>

<template>
  <div>
    Hello, World!
  </div>
</template>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: optionalType(STRING_TYPE),
        bar: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: {},
    });
  });

  test("export default defineComponent() simple case", async () => {
    expect(
      await analyze(
        `
<template>
  <div>{{ label }}</div>
</template>
<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    foo: String,
    bar: { type: String, required: true },
  },
});
</script>
`
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        foo: optionalType(STRING_TYPE),
        bar: STRING_TYPE,
      }),
      providedArgs: EMPTY_SET,
      types: expect.anything(),
    });
  });

  test("export default defineComponent() complex case", async () => {
    // Source: https://github.com/storybookjs/storybook/blob/4aa1f9944c9ede050c23afcc6861acf99cf5e841/examples/vue-3-cli/src/stories/Button.vue
    expect(
      await analyze(
        `
  <template>
    <div>{{ label }}</div>
  </template>

  <script lang="typescript">
  import { reactive, computed, defineComponent } from 'vue';

  export default defineComponent({
    name: 'App',

    props: {
      label: {
        type: String,
        required: true,
      },
      sublabel: {
        type: String,
        default: 'sublabel',
      },
      primary: {
        type: Boolean,
        default: false,
      },
      size: {
        type: String,
        validator: function (value) {
          return ['small', 'medium', 'large'].indexOf(value) !== -1;
        },
      },
      backgroundColor: {
        type: String,
      },
    },

    emits: ['click'],

    setup(props, { emit }) {
      props = reactive(props);
      return {
        style: computed(() => ({
          backgroundColor: props.backgroundColor,
        })),
        onClick() {
          emit('click');
        }
      }
    },
  });
  </script>
  `
      )
    ).toEqual({
      name: "App",
      propsType: objectType({
        label: STRING_TYPE,
        sublabel: optionalType(STRING_TYPE),
        primary: optionalType(BOOLEAN_TYPE),
        size: optionalType(STRING_TYPE),
        backgroundColor: optionalType(STRING_TYPE),
      }),
      providedArgs: EMPTY_SET,
      types: expect.anything(),
    });
  });

  async function analyze(source: string) {
    memoryReader.updateFile(MAIN_FILE, source);
    return analyzeVueComponentFromTemplate(
      typescriptAnalyzer,
      (program) => createTypeAnalyzer(ROOT_DIR_PATH, program, {}, {}),
      MAIN_FILE
    );
  }
});
