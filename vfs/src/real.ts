import chokidar from "chokidar";
import fs from "fs-extra";
import path from "path";
import type {
  Directory,
  DirectorySync,
  Entry,
  EntrySync,
  File,
  FileSync,
  Reader,
} from "./api";
import { ReaderListeners } from "./listeners";

export class FsReader implements Reader {
  readonly listeners = new ReaderListeners();

  constructor(
    private readonly options: {
      mapping: { from: string; to: string };
      watch: boolean;
    }
  ) {}

  observe = this.options.watch
    ? async (path: string): Promise<() => Promise<void>> => {
        const watcher = chokidar.watch([path], {
          ignored: ["**/node_modules/**", "**/.git/**"],
          ignoreInitial: true,
          ignorePermissionErrors: true,
        });
        watcher.on("all", (_event, absoluteFilePath) => {
          this.listeners.notify(this.mappedPath(absoluteFilePath), {
            virtual: false,
          });
        });
        return async () => {
          await watcher.close();
        };
      }
    : undefined;

  async read(absoluteFilePath: string): Promise<Entry | null> {
    const realPath = this.realPath(absoluteFilePath);
    if (!realPath || !(await fs.pathExists(realPath))) {
      return null;
    }
    return this.readExisting(realPath);
  }

  readSync(absoluteFilePath: string): EntrySync | null {
    const realPath = this.realPath(absoluteFilePath);
    if (!realPath || !fs.pathExistsSync(realPath)) {
      return null;
    }
    return this.readExistingSync(realPath);
  }

  private async readExisting(absoluteFilePath: string): Promise<Entry | null> {
    const lstat = await fs.lstat(absoluteFilePath);
    if (lstat.isDirectory()) {
      return this.readDirectory(absoluteFilePath);
    } else if (lstat.isFile()) {
      return this.readFile(absoluteFilePath);
    } else if (lstat.isSymbolicLink()) {
      return this.readSymbolicLink(absoluteFilePath);
    } else {
      return null;
    }
  }

  private readExistingSync(absoluteFilePath: string): EntrySync | null {
    const lstat = fs.lstatSync(absoluteFilePath);
    if (lstat.isDirectory()) {
      return this.readDirectorySync(absoluteFilePath);
    } else if (lstat.isFile()) {
      return this.readFileSync(absoluteFilePath);
    } else if (lstat.isSymbolicLink()) {
      return this.readSymbolicLinkSync(absoluteFilePath);
    } else {
      return null;
    }
  }

  private async readDirectory(dirPath: string): Promise<Directory> {
    const name = path.basename(dirPath);
    return {
      kind: "directory",
      name,
      entries: async () => {
        const entries = await Promise.all(
          (
            await fs.readdir(dirPath)
          ).map((f) => this.readExisting(path.join(dirPath, f)))
        );
        return entries.filter(Boolean) as Entry[];
      },
    };
  }

  private readDirectorySync(dirPath: string): DirectorySync {
    const name = path.basename(dirPath);
    return {
      kind: "directory",
      name,
      entries: () => {
        const entries = fs
          .readdirSync(dirPath)
          .map((f) => this.readExistingSync(path.join(dirPath, f)));
        return entries.filter(Boolean) as EntrySync[];
      },
    };
  }

  private async readFile(absoluteFilePath: string): Promise<File> {
    const name = path.basename(absoluteFilePath);
    let stat: Promise<fs.Stats> | null;
    const getStat = () => {
      if (stat) {
        return stat;
      }
      return (stat = fs.lstat(absoluteFilePath));
    };
    return {
      kind: "file",
      name,
      realPath: async () => absoluteFilePath,
      lastModifiedMillis: async () => {
        return (await getStat()).mtimeMs;
      },
      size: async () => {
        return (await getStat()).size;
      },
      read: () => fs.readFile(absoluteFilePath, "utf8"),
    };
  }

  private readFileSync(absoluteFilePath: string): FileSync {
    const name = path.basename(absoluteFilePath);
    let stat: fs.Stats | null;
    const getStat = () => {
      if (stat) {
        return stat;
      }
      return (stat = fs.lstatSync(absoluteFilePath));
    };
    return {
      kind: "file",
      name,
      realPath: () => absoluteFilePath,
      lastModifiedMillis: () => {
        return getStat().mtimeMs;
      },
      size: () => {
        return getStat().size;
      },
      read: () => fs.readFileSync(absoluteFilePath, "utf8"),
    };
  }

  private async readSymbolicLink(
    absoluteFilePath: string
  ): Promise<File | Directory> {
    const name = path.basename(absoluteFilePath);
    const lstat = await fs.lstat(absoluteFilePath);
    if (lstat.isSymbolicLink()) {
      const target = await fs.readlink(absoluteFilePath);
      if (!(await fs.pathExists(target))) {
        // The target does not exist.
        return {
          kind: "directory",
          name,
          entries: async () => [],
        };
      }
    }
    const stat = await fs.stat(absoluteFilePath);
    if (stat.isFile()) {
      return {
        kind: "file",
        name,
        realPath: async () => absoluteFilePath,
        lastModifiedMillis: async () => {
          return Math.max(lstat.mtimeMs, stat.mtimeMs);
        },
        size: async () => {
          return stat.size;
        },
        read: () => fs.readFile(absoluteFilePath, "utf8"),
      };
    } else {
      return {
        kind: "directory",
        name,
        entries: async () => {
          const entries = await Promise.all(
            (
              await fs.readdir(absoluteFilePath)
            ).map((f) => this.readExisting(path.join(absoluteFilePath, f)))
          );
          return entries.filter(Boolean) as Entry[];
        },
      };
    }
  }

  private readSymbolicLinkSync(
    absoluteFilePath: string
  ): FileSync | DirectorySync {
    const name = path.basename(absoluteFilePath);
    const lstat = fs.lstatSync(absoluteFilePath);
    if (lstat.isSymbolicLink()) {
      const target = fs.readlinkSync(absoluteFilePath);
      if (!fs.pathExistsSync(target)) {
        // The target does not exist.
        return {
          kind: "directory",
          name,
          entries: () => [],
        };
      }
    }
    const stat = fs.statSync(absoluteFilePath);
    if (stat.isFile()) {
      return {
        kind: "file",
        name,
        realPath: () => absoluteFilePath,
        lastModifiedMillis: () => {
          return Math.max(lstat.mtimeMs, stat.mtimeMs);
        },
        size: () => {
          return stat.size;
        },
        read: () => fs.readFileSync(absoluteFilePath, "utf8"),
      };
    } else {
      return {
        kind: "directory",
        name,
        entries: () => {
          const entries = fs
            .readdirSync(absoluteFilePath)
            .map((f) => this.readExistingSync(path.join(absoluteFilePath, f)));
          return entries.filter(Boolean) as EntrySync[];
        },
      };
    }
  }

  private realPath(absoluteFilePath: string) {
    const relativePath = path.relative(
      this.options.mapping.to,
      absoluteFilePath
    );
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      // Disallow access outside of mapping.from.
      return null;
    }
    return path.join(this.options.mapping.from, relativePath);
  }

  private mappedPath(absoluteFilePath: string) {
    return path.join(
      this.options.mapping.from,
      path.relative(this.options.mapping.to, absoluteFilePath)
    );
  }
}
