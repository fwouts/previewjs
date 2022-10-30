import {
  Directory,
  DirectorySync,
  Entry,
  EntrySync,
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

  observe?(path: string): Promise<() => Promise<void>>;

  constructor(private readonly reader: Reader) {
    reader.listeners.add({
      onChange: (absoluteFilePath, info) => {
        this.listeners.notify(absoluteFilePath, info);
      },
    });
    this.observe = reader.observe?.bind(reader);
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
    const entry = await this.reader.read(filePath);
    if (entry?.kind === "directory") {
      return {
        ...entry,
        entries: async () => {
          const realEntries = await entry.entries();
          return Promise.all([
            ...realEntries.map((e) => this.read(path.join(filePath, e.name))),
            ...realEntries
              .filter((e) => e.name.endsWith(".svelte"))
              .map((e) => this.read(path.join(filePath, e.name + ".ts"))),
          ]).then((entries) => entries.filter(Boolean)) as Promise<Entry[]>;
        },
      };
    }
    return entry;
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
    const entry = this.reader.readSync(filePath);
    if (entry?.kind === "directory") {
      return {
        ...entry,
        entries: () => {
          const realEntries = entry.entries();
          return [
            ...realEntries.map((e) =>
              this.readSync(path.join(filePath, e.name))
            ),
            ...realEntries
              .filter((e) => e.name.endsWith(".svelte"))
              .map((e) => this.readSync(path.join(filePath, e.name + ".ts"))),
          ].filter(Boolean) as EntrySync[];
        },
      };
    }
    return entry;
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
