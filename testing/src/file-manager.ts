import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import fs from "fs-extra";
import path from "path";

export function prepareFileManager(
  rootDirPath: string,
  onBeforeFileUpdated: () => void
) {
  const memoryReader = createMemoryReader();
  const reader = createStackedReader([
    memoryReader,
    createFileSystemReader({
      watch: true,
    }),
  ]);
  let lastDiskWriteMillis = 0;
  const fileManager: FileManager = {
    rootPath: rootDirPath,
    update: async (f, content, { inMemoryOnly } = {}) => {
      await onBeforeFileUpdated();
      if (!inMemoryOnly) {
        // In order to make sure that chokidar doesn't
        // mistakenly merge events, resulting in flaky tests
        // when they run very fast, force some time to elapse.
        const now = Date.now();
        if (lastDiskWriteMillis > now - 500) {
          await new Promise((resolve) =>
            setTimeout(resolve, lastDiskWriteMillis + 500 - now)
          );
        }
        lastDiskWriteMillis = Date.now();
      }
      const absoluteFilePath = path.join(rootDirPath, f);
      let text: string;
      if (typeof content === "string") {
        text = content;
      } else {
        const existing = await fs.readFile(absoluteFilePath, "utf8");
        text = existing.replace(content.replace, content.with);
      }
      if (inMemoryOnly === true) {
        await memoryReader.updateFile(absoluteFilePath, text);
      } else {
        const dirPath = path.dirname(absoluteFilePath);
        await fs.mkdirp(dirPath);
        await fs.writeFile(absoluteFilePath, text, "utf8");
      }
    },
    rename: async (from, to) => {
      await onBeforeFileUpdated();
      await fs.rename(path.join(rootDirPath, from), path.join(rootDirPath, to));
    },
    remove: async (f) => {
      await onBeforeFileUpdated();
      await fs.unlink(path.join(rootDirPath, f));
    },
  };
  return {
    reader,
    fileManager,
  };
}

export interface FileManager {
  rootPath: string;
  update(
    filePath: string,
    content:
      | {
          replace: string | RegExp;
          with: string;
        }
      | string,
    options?: {
      inMemoryOnly?: boolean;
    }
  ): Promise<void>;
  rename(fromFilePath: string, toFilePath: string): Promise<void>;
  remove(filePath: string): Promise<void>;
}
