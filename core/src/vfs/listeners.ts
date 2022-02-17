import { ReaderListener, ReaderListenerInfo } from "./api";

export class ReaderListeners {
  readonly listeners = new Set<ReaderListener>();

  constructor() {}

  async add(listener: ReaderListener) {
    this.listeners.add(listener);
  }

  async remove(listener: ReaderListener) {
    this.listeners.delete(listener);
  }

  notify = (filePath: string, info: ReaderListenerInfo) => {
    for (const listener of [...this.listeners]) {
      listener.onChange(filePath, info);
    }
  };
}
