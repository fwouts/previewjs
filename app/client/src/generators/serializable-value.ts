export type SerializableValue =
  | SerializableArrayValue
  | SerializableBooleanValue
  | SerializableFunctionValue
  | SerializableMapValue
  | SerializableNullValue
  | SerializableNumberValue
  | SerializableObjectValue
  | SerializablePromiseValue
  | SerializableSetValue
  | SerializableStringValue
  | SerializableUndefinedValue
  | SerializableUnknownValue;

export type SerializableArrayValue = {
  kind: "array";
  items: SerializableValue[];
};

export function array(items: SerializableValue[]): SerializableArrayValue {
  return {
    kind: "array",
    items,
  };
}

export const EMPTY_ARRAY = array([]);

export type SerializableBooleanValue = {
  kind: "boolean";
  value: boolean;
};

export function boolean(value: boolean): SerializableBooleanValue {
  return {
    kind: "boolean",
    value,
  };
}

export const FALSE = boolean(false);

export const TRUE = boolean(true);

export type SerializableFunctionValue = {
  kind: "function";
  returnValue: SerializableValue;
};

export function fn(returnValue: SerializableValue): SerializableFunctionValue {
  return {
    kind: "function",
    returnValue,
  };
}

export type SerializableMapValue = {
  kind: "map";
  values: SerializableObjectValue;
};

export function map(values: SerializableObjectValue): SerializableMapValue {
  return {
    kind: "map",
    values,
  };
}

export const NULL = { kind: "null" } as const;

export type SerializableNullValue = typeof NULL;

export type SerializableNumberValue = {
  kind: "number";
  value: number;
};

export function number(value: number): SerializableNumberValue {
  return {
    kind: "number",
    value,
  };
}

export type SerializableObjectValue = {
  kind: "object";
  entries: SerializableObjectValueEntry[];
};

export type SerializableObjectValueEntry = {
  key: SerializableValue;
  value: SerializableValue;
};

export function object(
  entries: SerializableObjectValueEntry[]
): SerializableObjectValue {
  return {
    kind: "object",
    entries,
  };
}

export type SerializablePromiseValue = {
  kind: "promise";
  value:
    | {
        type: "reject";
        message: string | null;
      }
    | {
        type: "resolve";
        value: SerializableValue;
      };
};

export function promise(
  value:
    | {
        type: "reject";
        message: string | null;
      }
    | {
        type: "resolve";
        value: SerializableValue;
      }
): SerializablePromiseValue {
  return {
    kind: "promise",
    value,
  };
}

export const EMPTY_OBJECT = object([]);

export type SerializableSetValue = {
  kind: "set";
  values: SerializableArrayValue;
};

export function set(values: SerializableArrayValue): SerializableSetValue {
  return {
    kind: "set",
    values,
  };
}

export type SerializableStringValue = {
  kind: "string";
  value: string;
};

export function string(value: string): SerializableStringValue {
  return {
    kind: "string",
    value,
  };
}

export const UNDEFINED = { kind: "undefined" } as const;

export type SerializableUndefinedValue = typeof UNDEFINED;

export const UNKNOWN = { kind: "unknown" } as const;

export type SerializableUnknownValue = typeof UNKNOWN;
