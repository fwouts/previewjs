declare global {
  interface Window {
    __expectFutureRefresh__: () => void;
    __waitForExpectedRefresh__: () => Promise<void>;
  }
}

export {};
