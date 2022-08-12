import { isEqual } from "lodash";
import { inspect } from "util";

export function expect(value: unknown) {
  if (typeof value === "string") {
    value = value.replace(/\r/g, "");
  }
  return {
    toEqual(expected: unknown) {
      if (!isEqual(value, expected)) {
        throw new Error(
          `Expected: ${inspect(expected)}\nGot: ${inspect(value)}`
        );
      }
    },
    toStartWith(expected: string) {
      if (typeof value !== "string") {
        throw new Error(`Expected a string, got: ${inspect(value)}`);
      }
      if (!value.startsWith(expected)) {
        throw new Error(
          `Expected to start with: ${inspect(expected)}\nGot: ${inspect(value)}`
        );
      }
    },
    toContain(expected: string) {
      if (typeof value !== "string") {
        throw new Error(`Expected a string, got: ${inspect(value)}`);
      }
      if (!value.includes(expected)) {
        throw new Error(
          `Expected to contain: ${inspect(expected)}\nGot: ${inspect(value)}`
        );
      }
    },
    toNotEqual(expected: unknown) {
      if (isEqual(value, expected)) {
        throw new Error(`Equal: ${inspect(value)}`);
      }
    },
  };
}
