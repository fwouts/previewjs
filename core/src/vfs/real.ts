import chokidar from "chokidar";
import fs from "fs-extra";
import { autorun } from "mobx";
import path from "path";
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

export class FsReader implements Reader {
  private watcher: chokidar.FSWatcher | null = null;
  private watchedPaths = new Set<string>();

  readonly listeners = new ReaderListeners();

  constructor(
    private readonly options: {
      mapping: { from: string; to: string };
    }
  ) {
    autorun(() => {
      const observedPaths = this.listeners.observedFilePaths;
      // Ideally we should apply the reverse mapping
      // (observing "from" path when a listener asks to
      // observe "to" path). However this isn't used
      // in practice.
      if (observedPaths.size === 0) {
        if (this.watcher) {
          this.watcher.close().catch(console.error);
          this.watcher = null;
        }
      } else if (this.watcher) {
        this.watcher.unwatch(
          [...this.watchedPaths].filter((p) => !observedPaths.has(p))
        );
        this.watcher.add(
          [...observedPaths].filter((p) => this.watchedPaths.has(p))
        );
      } else {
        const watcher = chokidar.watch([...observedPaths], {
          ignored: ["**/node_modules/**", "**/.git/**"],
          ignoreInitial: true,
          ignorePermissionErrors: true,
        });
        watcher.on("all", (_event, filePath) => {
          this.listeners.notify(this.mappedPath(filePath), {
            virtual: false,
          });
        });
        this.watcher = watcher;
      }
      this.watchedPaths = observedPaths;
    });
  }

  async read(filePath: string): Promise<Entry | null> {
    const realPath = this.realPath(filePath);
    if (!(await fs.pathExists(realPath))) {
      return null;
    }
    return this.readExisting(realPath);
  }

  readSync(filePath: string): EntrySync | null {
    const realPath = this.realPath(filePath);
    if (!fs.pathExistsSync(realPath)) {
      return null;
    }
    return this.readExistingSync(realPath);
  }

  private async readExisting(filePath: string): Promise<Entry | null> {
    const lstat = await fs.lstat(filePath);
    if (lstat.isDirectory()) {
      return this.readDirectory(filePath);
    } else if (lstat.isFile()) {
      return this.readFile(filePath);
    } else if (lstat.isSymbolicLink()) {
      return this.readSymbolicLink(filePath);
    } else {
      return null;
    }
  }

  private readExistingSync(filePath: string): EntrySync | null {
    const lstat = fs.lstatSync(filePath);
    if (lstat.isDirectory()) {
      return this.readDirectorySync(filePath);
    } else if (lstat.isFile()) {
      return this.readFileSync(filePath);
    } else if (lstat.isSymbolicLink()) {
      return this.readSymbolicLinkSync(filePath);
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

  private async readFile(filePath: string): Promise<File> {
    const name = path.basename(filePath);
    let stat: Promise<fs.Stats> | null;
    const getStat = () => {
      if (stat) {
        return stat;
      }
      return (stat = fs.lstat(filePath));
    };
    return {
      kind: "file",
      name,
      realPath: async () => filePath,
      lastModifiedMillis: async () => {
        return (await getStat()).mtimeMs;
      },
      size: async () => {
        return (await getStat()).size;
      },
      read: () => fs.readFile(filePath, "utf8"),
    };
  }

  private readFileSync(filePath: string): FileSync {
    const name = path.basename(filePath);
    let stat: fs.Stats | null;
    const getStat = () => {
      if (stat) {
        return stat;
      }
      return (stat = fs.lstatSync(filePath));
    };
    return {
      kind: "file",
      name,
      realPath: () => filePath,
      lastModifiedMillis: () => {
        return getStat().mtimeMs;
      },
      size: () => {
        return getStat().size;
      },
      read: () => fs.readFileSync(filePath, "utf8"),
    };
  }

  private async readSymbolicLink(filePath: string): Promise<File | Directory> {
    const name = path.basename(filePath);
    const lstat = await fs.lstat(filePath);
    if (lstat.isSymbolicLink()) {
      const target = await fs.readlink(filePath);
      if (!(await fs.pathExists(target))) {
        // The target does not exist.
        return {
          kind: "directory",
          name,
          entries: async () => [],
        };
      }
    }
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      return {
        kind: "file",
        name,
        realPath: async () => filePath,
        lastModifiedMillis: async () => {
          return Math.max(lstat.mtimeMs, stat.mtimeMs);
        },
        size: async () => {
          return stat.size;
        },
        read: () => fs.readFile(filePath, "utf8"),
      };
    } else {
      return {
        kind: "directory",
        name,
        entries: async () => {
          const entries = await Promise.all(
            (
              await fs.readdir(filePath)
            ).map((f) => this.readExisting(path.join(filePath, f)))
          );
          return entries.filter(Boolean) as Entry[];
        },
      };
    }
  }

  private readSymbolicLinkSync(filePath: string): FileSync | DirectorySync {
    const name = path.basename(filePath);
    const lstat = fs.lstatSync(filePath);
    if (lstat.isSymbolicLink()) {
      const target = fs.readlinkSync(filePath);
      if (!fs.pathExistsSync(target)) {
        // The target does not exist.
        return {
          kind: "directory",
          name,
          entries: () => [],
        };
      }
    }
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      return {
        kind: "file",
        name,
        realPath: () => filePath,
        lastModifiedMillis: () => {
          return Math.max(lstat.mtimeMs, stat.mtimeMs);
        },
        size: () => {
          return stat.size;
        },
        read: () => fs.readFileSync(filePath, "utf8"),
      };
    } else {
      return {
        kind: "directory",
        name,
        entries: () => {
          const entries = fs
            .readdirSync(filePath)
            .map((f) => this.readExistingSync(path.join(filePath, f)));
          return entries.filter(Boolean) as EntrySync[];
        },
      };
    }
  }

  private realPath(filePath: string) {
    return path.join(
      this.options.mapping.from,
      path.relative(this.options.mapping.to, filePath)
    );
  }

  private mappedPath(filePath: string) {
    return path.join(
      this.options.mapping.from,
      path.relative(this.options.mapping.to, filePath)
    );
  }
}
