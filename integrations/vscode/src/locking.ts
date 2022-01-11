let locked: Promise<void> | null = null;
export async function locking<T>(f: () => Promise<T>): Promise<T> {
  while (locked) {
    await locked;
  }
  const promise = f();
  locked = promise
    .catch(() => null)
    .then(() => {
      locked = null;
    });
  return promise;
}
