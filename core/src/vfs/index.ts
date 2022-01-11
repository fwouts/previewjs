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
  } = {}
): Reader {
  return new FsReader({
    mapping: options.mapping || {
      from: "/",
      to: "/",
    },
  });
}

export function createStackedReader(readers: Reader[]): Reader {
  return new StackedReader(readers);
}
