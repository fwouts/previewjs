import {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
  ReaderListeners,
} from "@previewjs/core/vfs";
import { parse } from "@vue/compiler-sfc";
import path from "path";

/**
 * Returns a reader that returns a virtual TypeScript file
 * named foo.vue.ts for every corresponding foo.vue file.
 */
export function createVueTypeScriptReader(reader: Reader): Reader {
  return new VueTypeScriptReader(reader);
}

class VueTypeScriptReader implements Reader {
  readonly listeners = new ReaderListeners();

  constructor(private readonly reader: Reader) {
    reader.listeners.add({
      onChange: (filePath, info) => {
        this.listeners.notify(filePath, info);
      },
    });
  }

  observe = this.reader.observe?.bind(this.reader);

  async read(filePath: string): Promise<File | Directory | null> {
    if (filePath.endsWith(".vue.ts")) {
      const source = await this.reader.read(
        filePath.substr(0, filePath.length - 3)
      );
      if (source?.kind !== "file") {
        return null;
      }
      const name = path.basename(filePath);
      return {
        kind: "file",
        name,
        realPath: async () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: async () => convertToTypeScript(await source.read(), name),
        size: () => source.size(),
      };
    }
    return this.reader.read(filePath);
  }

  readSync(filePath: string): FileSync | DirectorySync | null {
    if (filePath.endsWith(".vue.ts")) {
      const source = this.reader.readSync(
        filePath.substr(0, filePath.length - 3)
      );
      if (source?.kind !== "file") {
        return null;
      }
      const name = path.basename(filePath);
      return {
        kind: "file",
        name,
        realPath: () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: () => convertToTypeScript(source.read(), name),
        size: () => source.size(),
      };
    }
    return this.reader.readSync(filePath);
  }
}

function convertToTypeScript(vueTemplateSource: string, name: string) {
  const parsed = parse(vueTemplateSource);
  return parsed.descriptor.scriptSetup
    ? `import { defineProps } from '@vue/runtime-core';\n${parsed.descriptor.scriptSetup.content}`
    : parsed.descriptor.script
    ? `${parsed.descriptor.script.content.replace(
        /export\s+default/,
        "const pjs_component ="
      )}

import type { Component as PJS_Component } from "@vue/runtime-core";

type PJS_ExtractProps<T> = T extends PJS_Component<infer S>
  ? S extends { $props: unknown }
    ? S["$props"]
    : never
  : never;

type PJS_Props = PJS_ExtractProps<typeof pjs_component>;
`
    : "";
}
