export * from "./api.js";
export { ReaderListeners } from "./listeners.js";
export type { InMemoryFilesSnapshot } from "./memory.js";
import type { Reader, Writer } from "./api.js";
import type { InMemoryFilesSnapshot } from "./memory.js";
import { MemoryReader } from "./memory.js";
import { FsReader } from "./real.js";
import { StackedReader } from "./stacked.js";

export function createMemoryReader(): Reader &
  Writer & { snapshot(): InMemoryFilesSnapshot } {
  return new MemoryReader();
}

export function createMemoryReaderFromSnapshot(
  snapshot: InMemoryFilesSnapshot
): Reader & Writer & { snapshot(): InMemoryFilesSnapshot } {
  return new MemoryReader(snapshot);
}

export function createFileSystemReader(
  options: {
    mapping?: { from: string; to: string };

    /**
     * Whether to watch directories that listeners observe.
     *
     * Defaults to true.
     */
    watch?: boolean;
  } = {}
): Reader {
  return new FsReader({
    mapping: options.mapping || {
      from: "/",
      to: "/",
    },
    watch: options.watch ?? true,
  });
}

export function createStackedReader(readers: Reader[]): Reader {
  return new StackedReader(readers);
}
