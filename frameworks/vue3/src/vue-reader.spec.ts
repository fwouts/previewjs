import { createMemoryReader, Reader, Writer } from "@previewjs/core/vfs";
import path from "path";
import { createVueTypeScriptReader } from "./vue-reader";

describe("createVueTypeScriptReader", () => {
  let memoryReader: Reader & Writer;
  let reader: Reader;

  beforeEach(() => {
    memoryReader = createMemoryReader();
    reader = createVueTypeScriptReader(memoryReader);
  });

  it("extracts from setup script", async () => {
    memoryReader.updateFile(
      path.join(__dirname, "virtual", "App.vue"),
      `
<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <h1>{{ msg }}</h1>
</template>  
    `
    );
    const virtualFile = await reader.read(
      path.join(__dirname, "virtual", "App.vue.ts")
    );
    if (virtualFile?.kind !== "file") {
      throw new Error();
    }
    expect(await virtualFile.read())
      .toEqual(`import { defineProps } from '@vue/runtime-core';

import { ref } from 'vue';

defineProps<{ msg: string }>()

const count = ref(0)
`);
  });

  it("extracts from normal script", async () => {
    memoryReader.updateFile(
      path.join(__dirname, "virtual", "App.vue"),
      `
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'App'
})
</script>

<template>
  <h1>{{ msg }}</h1>
</template>  
    `
    );
    const virtualFile = await reader.read(
      path.join(__dirname, "virtual", "App.vue.ts")
    );
    if (virtualFile?.kind !== "file") {
      throw new Error();
    }
    expect(await virtualFile.read()).toEqual(`
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'App'
})
`);
  });
});
