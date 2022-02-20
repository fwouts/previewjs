import { ReaderListener } from ".";
import { Directory, DirectorySync, Entry, EntrySync, Reader } from "./api";
import { ReaderListeners } from "./listeners";

export class StackedReader implements Reader {
  readonly listeners = new ReaderListeners();

  constructor(private readonly readers: Reader[]) {
    const asReaderListener: ReaderListener = {
      onChange: (filePath, info) => {
        this.listeners.notify(filePath, info);
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

  async read(filePath: string): Promise<Entry | null> {
    const found = await Promise.all(
      this.readers.map((reader) => reader.read(filePath))
    );
    const list = found.filter(Boolean) as Entry[];
    if (list.length === 0) {
      return null;
    }
    return merge(list);
  }

  readSync(filePath: string): EntrySync | null {
    const found = this.readers.map((reader) => reader.readSync(filePath));
    const list = found.filter(Boolean) as EntrySync[];
    if (list.length === 0) {
      return null;
    }
    return mergeSync(list);
  }
}

function merge(entries: Array<Entry>): Entry {
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
    throw new Error(`Encountered an empty list. This should never happen.`);
  }
  return {
    kind: "directory",
    name: first.name,
    entries: async () => {
      const entries: Record<string, Entry[]> = {};
      for (const directoryEntries of await Promise.all(
        mergedDirectories.map((d) => d.entries())
      )) {
        for (const entry of directoryEntries) {
          const array = entries[entry.name] || [];
          array.push(entry);
          entries[entry.name] = array;
        }
      }
      return Object.values(entries).map((entryList) => merge(entryList));
    },
  };
}

function mergeSync(entries: Array<EntrySync>): EntrySync {
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
    throw new Error(`Encountered an empty list. This should never happen.`);
  }
  return {
    kind: "directory",
    name: first.name,
    entries: () => {
      const entries: Record<string, EntrySync[]> = {};
      for (const directoryEntries of mergedDirectories.map((d) =>
        d.entries()
      )) {
        for (const entry of directoryEntries) {
          const array = entries[entry.name] || [];
          array.push(entry);
          entries[entry.name] = array;
        }
      }
      return Object.values(entries).map((entryList) => mergeSync(entryList));
    },
  };
}
