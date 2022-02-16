import { ReaderListener, ReaderListenerInfo } from "./api";

export class ReaderListeners {
  readonly listeners = new Set<ReaderListener>();

  constructor(readonly onChange: () => Promise<void>) {}

  add(listener: ReaderListener) {
    this.listeners.add(listener);
    this.onChange();
  }

  remove(listener: ReaderListener) {
    this.listeners.delete(listener);
    this.onChange();
  }

  get observedFilePaths(): Set<string> {
    return new Set(
      [...this.listeners].reduce<string[]>(
        (acc, curr) => [...acc, ...curr.observedPaths],
        []
      )
    );
  }

  notify = (filePath: string, info: ReaderListenerInfo) => {
    for (const listener of [...this.listeners]) {
      listener.onChange(filePath, info);
    }
  };
}
