// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers_with_special_meanings
const RESERVED_IDENTIFIERS = new Set(["arguments", "get", "set"]);

// TODO: Also support prop names that must be escaped.
export function isValidPropName(name: string) {
  return (
    /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(name) && !RESERVED_IDENTIFIERS.has(name)
  );
}
