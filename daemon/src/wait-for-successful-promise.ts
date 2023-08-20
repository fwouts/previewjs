export async function waitForTruePromise(
  f: () => Promise<boolean>,
  timeoutMillis = 5000,
  retryDelayMillis = 100
) {
  const startTime = Date.now();
  loop: while (true) {
    try {
      if (await f()) {
        break loop;
      }
    } catch (e) {
      if (Date.now() - startTime > timeoutMillis) {
        throw new Error(`Timed out after ${timeoutMillis}ms: ${e}`);
      }
      // Ignore the error and retry.
      await new Promise<void>((resolve) =>
        setTimeout(resolve, retryDelayMillis)
      );
    }
  }
}
