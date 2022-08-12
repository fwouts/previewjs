import type { ReaderListener, ReaderListenerInfo } from "./api";

export class ReaderListeners {
  readonly listeners = new Set<ReaderListener>();

  async add(listener: ReaderListener) {
    this.listeners.add(listener);
  }

  async remove(listener: ReaderListener) {
    this.listeners.delete(listener);
  }

  notify = (absoluteFilePath: string, info: ReaderListenerInfo) => {
    for (const listener of [...this.listeners]) {
      listener.onChange(absoluteFilePath, info);
    }
  };
}
