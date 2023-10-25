export * from "./api";
export { ReaderListeners } from "./listeners";
export type { InMemoryFilesSnapshot } from "./memory";
import type { Reader, Writer } from "./api";
import type { InMemoryFilesSnapshot } from "./memory";
import { MemoryReader } from "./memory";
import { FsReader } from "./real";
import { StackedReader } from "./stacked";

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
