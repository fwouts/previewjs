import {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
  ReaderListeners,
} from "@previewjs/vfs";
import path from "path";
import { preprocess } from "svelte/compiler";

/**
 * Returns a reader that returns a virtual TypeScript file
 * named foo.svelte.ts for every corresponding foo.svelte file.
 */
export function createSvelteTypeScriptReader(reader: Reader): Reader {
  return new SvelteTypeScriptReader(reader);
}

class SvelteTypeScriptReader implements Reader {
  readonly listeners = new ReaderListeners();

  constructor(private readonly reader: Reader) {
    reader.listeners.add({
      onChange: (absoluteFilePath, info) => {
        this.listeners.notify(absoluteFilePath, info);
      },
    });
  }

  async read(filePath: string): Promise<File | Directory | null> {
    if (filePath.endsWith(".svelte.ts")) {
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
    if (filePath.endsWith(".svelte.ts")) {
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

function convertToTypeScript(svelteTemplateSource: string) {
  // Note: preprocess returns a promise, but it runs immediately.
  let scriptContent = "";
  preprocess(svelteTemplateSource, [
    {
      script: ({ content }) => {
        scriptContent = content;
        return {
          code: "",
        };
      },
    },
  ]);
  return scriptContent;
}
