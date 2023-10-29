import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import fs from "fs-extra";
import path from "path";
import { duplicateProjectForTesting } from "./test-dir.js";

export async function prepareFileManager({
  testProjectDirPath,
  onBeforeFileUpdated = async () => {
    /* no-op by default */
  },
  onAfterFileUpdated = async () => {
    /* no-op by default */
  },
}: {
  testProjectDirPath: string;
  onBeforeFileUpdated?: () => void;
  onAfterFileUpdated?: () => void;
}) {
  const rootDir = duplicateProjectForTesting(testProjectDirPath);
  // Introduce an artificial wait to prevent chokidar from mistakenly detecting
  // newly created files as "just changed" and emitting events by mistake.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const memoryReader = createMemoryReader();
  const fsReader = createFileSystemReader({
    watch: true,
  });
  const reader = createStackedReader([memoryReader, fsReader]);
  let lastDiskWriteMillis = 0;
  const fileManager: FileManager = {
    read: async (f, { inMemoryOnly } = {}) => {
      const entry = await (inMemoryOnly ? memoryReader : fsReader).read(f);
      if (entry?.kind !== "file") {
        throw new Error(`Not a file: ${f}`);
      }
      return entry.read();
    },
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
      const absoluteFilePath = path.join(rootDir, f);
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
      await onAfterFileUpdated();
    },
    rename: async (from, to) => {
      await onBeforeFileUpdated();
      await fs.rename(path.join(rootDir, from), path.join(rootDir, to));
      await onAfterFileUpdated();
    },
    remove: async (f) => {
      await onBeforeFileUpdated();
      await fs.unlink(path.join(rootDir, f));
      await onAfterFileUpdated();
    },
  };
  return {
    rootDir,
    reader,
    fileManager,
  };
}

export interface FileManager {
  read(
    filePath: string,
    options?: {
      inMemoryOnly?: boolean;
    }
  ): Promise<string>;
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
