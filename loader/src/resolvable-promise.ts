export type ResolvablePromise<T> = Promise<T> & {
  resolved: T | null;
};

export function resolvablePromise<T>(promise: Promise<T>) {
  let onResolve: (value: T) => void;
  let onReject: (error: any) => void;
  const resolvablePromise = new Promise<T>((resolve, reject) => {
    onResolve = resolve;
    onReject = reject;
  }) as ResolvablePromise<T>;
  resolvablePromise.resolved = null;
  promise
    .then((value) => {
      resolvablePromise.resolved = value;
      onResolve(value);
    })
    .catch((e) => {
      onReject(e);
    });
  return resolvablePromise;
}
