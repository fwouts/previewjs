import assertNever from "assert-never";
import path from "path";
import { Writer } from ".";
import {
  Directory,
  DirectorySync,
  Entry,
  EntrySync,
  File,
  FileSync,
  Reader,
} from "./api";
import { ReaderListeners } from "./listeners";

const utf8Encoder = new TextEncoder();
export class MemoryReader implements Reader, Writer {
  readonly listeners = new ReaderListeners();

  private files: { [filePath: string]: MemoryFile } = {};

  updateFile(filePath: string, sourceText: string | null): boolean {
    // Note: backslash handling is Windows-specific.
    filePath = filePath.replace(/\//g, path.sep);
    let changed: boolean;
    if (sourceText === null) {
      delete this.files[filePath];
      changed = true;
    } else {
      const existingSource = this.files[filePath]?.sourceText;
      if (sourceText === existingSource) {
        changed = false;
      } else {
        this.files[filePath] = {
          sourceText,
          timestampMillis: Date.now(),
        };
        changed = true;
      }
    }
    if (changed) {
      this.listeners.notify(filePath, {
        virtual: true,
      });
    }
    return changed;
  }

  async read(filePath: string): Promise<Entry | null> {
    const entry = this.readSync(filePath);
    if (!entry) {
      return null;
    }
    return fromSyncEntry(entry);
  }

  readSync(filePath: string): EntrySync | null {
    // Note: backslash handling is Windows-specific.
    filePath = filePath.replace(/\//g, path.sep);
    const file = this.files[filePath];
    if (file) {
      return this.readFile(filePath, file);
    }
    const dirPath = filePath.endsWith(path.sep)
      ? filePath.substr(0, filePath.length - 1)
      : filePath;
    for (const otherFilePath of Object.keys(this.files)) {
      if (otherFilePath.startsWith(dirPath + path.sep)) {
        return this.readDirectory(dirPath);
      }
    }
    return null;
  }

  private readFile(filePath: string, file: MemoryFile): FileSync {
    return {
      kind: "file",
      name: path.basename(filePath),
      realPath: () => null,
      lastModifiedMillis: () => file.timestampMillis,
      read: () => file.sourceText,
      size: () => utf8Encoder.encode(file.sourceText).byteLength,
    };
  }

  private readDirectory(dirPath: string): DirectorySync {
    return {
      kind: "directory",
      name: path.basename(dirPath),
      entries: () => this.readDirectoryEntries(dirPath),
    };
  }

  private readDirectoryEntries(dirPath: string): EntrySync[] {
    const directories = new Set<string>();
    const files: FileSync[] = [];
    for (const [filePath, file] of Object.entries(this.files)) {
      if (filePath.startsWith(dirPath + path.sep)) {
        const relativePath = filePath.substr(dirPath.length + 1);
        const [name, ...rest] = relativePath.split(path.sep);
        if (!name) {
          continue;
        }
        if (rest.length === 0) {
          files.push(this.readFile(filePath, file));
        } else {
          directories.add(name);
        }
      }
    }
    return [
      ...files,
      ...[...directories].map((dirName) =>
        this.readDirectory(path.join(dirPath, dirName))
      ),
    ];
  }
}

function fromSyncEntry(entry: EntrySync): Entry {
  switch (entry.kind) {
    case "file":
      return fromSyncFile(entry);
    case "directory":
      return fromSyncDirectory(entry);
    default:
      throw assertNever(entry);
  }
}

function fromSyncFile(file: FileSync): File {
  return {
    kind: "file",
    name: file.name,
    realPath: async () => file.realPath(),
    lastModifiedMillis: async () => file.lastModifiedMillis(),
    size: async () => file.size(),
    read: async () => file.read(),
  };
}

function fromSyncDirectory(dir: DirectorySync): Directory {
  return {
    kind: "directory",
    name: dir.name,
    entries: async () => dir.entries().map(fromSyncEntry),
  };
}

export interface MemoryFile {
  timestampMillis: number;
  sourceText: string;
}
