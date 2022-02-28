import { ReaderListener } from ".";
import { Directory, DirectorySync, Entry, EntrySync, Reader } from "./api";
import { ReaderListeners } from "./listeners";

export class StackedReader implements Reader {
  readonly listeners = new ReaderListeners();

  constructor(private readonly readers: Reader[]) {
    const asReaderListener: ReaderListener = {
      onChange: (absoluteFilePath, info) => {
        this.listeners.notify(absoluteFilePath, info);
      },
    };
    for (const reader of this.readers) {
      reader.listeners.add(asReaderListener);
    }
  }

  async observe(path: string) {
    const disposeFns: Array<() => Promise<void>> = [];
    for (const reader of this.readers) {
      if (reader.observe) {
        disposeFns.push(await reader.observe(path));
      }
    }
    return async () => {
      await Promise.all(disposeFns.map((disposeFn) => disposeFn()));
    };
  }

  async read(absoluteFilePath: string): Promise<Entry | null> {
    const found = await Promise.all(
      this.readers.map((reader) => reader.read(absoluteFilePath))
    );
    return merge(found);
  }

  readSync(absoluteFilePath: string): EntrySync | null {
    const found = this.readers.map((reader) =>
      reader.readSync(absoluteFilePath)
    );
    return mergeSync(found);
  }
}

function merge(entries: Array<Entry | null>): Entry | null {
  const mergedDirectories: Directory[] = [];
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    if (entry.kind === "file") {
      // Return the first match.
      return entry;
    }
    mergedDirectories.push(entry);
  }
  const [first] = mergedDirectories;
  if (!first) {
    return null;
  }
  return {
    kind: "directory",
    name: first.name,
    entries: async () => {
      const names = new Set<string>();
      const uniques: Entry[] = [];
      for (const directoryEntries of mergedDirectories.map((d) =>
        d.entries()
      )) {
        for (const entry of await directoryEntries) {
          if (names.has(entry.name)) {
            continue;
          }
          names.add(entry.name);
          uniques.push(entry);
        }
      }
      return uniques;
    },
  };
}

function mergeSync(entries: Array<EntrySync | null>): EntrySync | null {
  const mergedDirectories: DirectorySync[] = [];
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    if (entry.kind === "file") {
      // Return the first match.
      return entry;
    }
    mergedDirectories.push(entry);
  }
  const [first] = mergedDirectories;
  if (!first) {
    return null;
  }
  return {
    kind: "directory",
    name: first.name,
    entries: () => {
      const names = new Set<string>();
      const uniques: EntrySync[] = [];
      for (const directoryEntries of mergedDirectories.map((d) =>
        d.entries()
      )) {
        for (const entry of directoryEntries) {
          if (names.has(entry.name)) {
            continue;
          }
          names.add(entry.name);
          uniques.push(entry);
        }
      }
      return uniques;
    },
  };
}
