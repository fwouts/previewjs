export * from "./api";
import { Reader, Writer } from "./api";
import { MemoryReader } from "./memory";
import { FsReader } from "./real";
import { StackedReader } from "./stacked";

export function createMemoryReader(): Reader & Writer {
  return new MemoryReader();
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
