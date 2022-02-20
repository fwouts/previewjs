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
      return {
        kind: "file",
        name: path.basename(filePath),
        realPath: async () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: async () => convertToTypeScript(await source.read()),
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
      return {
        kind: "file",
        name: path.basename(filePath),
        realPath: () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: () => convertToTypeScript(source.read()),
        size: () => source.size(),
      };
    }
    return this.reader.readSync(filePath);
  }
}

function convertToTypeScript(vueTemplateSource: string) {
  const parsed = parse(vueTemplateSource);
  return parsed.descriptor.scriptSetup
    ? `import { defineProps } from '@vue/runtime-core';\n${parsed.descriptor.scriptSetup.content}`
    : parsed.descriptor.script
    ? parsed.descriptor.script.content
    : "";
}
