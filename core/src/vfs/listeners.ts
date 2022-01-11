import { action, computed, makeObservable, observable } from "mobx";
import { ReaderListener, ReaderListenerInfo } from "./api";

export class ReaderListeners {
  readonly listeners = new Set<ReaderListener>();

  constructor() {
    makeObservable(this, {
      listeners: observable.shallow,
      observedFilePaths: computed,
      add: action,
      remove: action,
    });
  }

  add(listener: ReaderListener) {
    this.listeners.add(listener);
  }

  remove(listener: ReaderListener) {
    this.listeners.delete(listener);
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
