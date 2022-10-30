const TIMEOUT_MILLIS = 60 * 1000;
const RETRY_SLEEP_MILLIS = 50;

export async function waitFor(
  predicateFunction: () => Promise<boolean>
): Promise<void> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out`)), TIMEOUT_MILLIS)
  );
  let predicate = false;
  while (!predicate) {
    const predicatePromise = predicateFunction();
    await Promise.race([timeoutPromise, predicatePromise]);
    predicate = await predicatePromise;
    if (!predicate) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_SLEEP_MILLIS));
    }
  }
}
