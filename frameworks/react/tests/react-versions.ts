export function reactVersions() {
  if (process.env.ONLY_REACT_VERSION) {
    return [parseInt(process.env.ONLY_REACT_VERSION)];
  }
  return [16, 17, 18];
}
