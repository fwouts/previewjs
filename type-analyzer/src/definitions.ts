import ts from "typescript";

export interface TypeAnalyzer {
  checker: ts.TypeChecker;
  sourceFile(filePath: string): ts.SourceFile;
  resolveType(type: ts.Type): {
    type: ValueType;
    collected: CollectedTypes;
  };
  resolveTypeArguments(type: ts.Type): {
    types: ValueType[];
    collected: CollectedTypes;
  };
}

export type ValueType =
  | AnyType
  | UnknownType
  | NeverType
  | VoidType
  | NullType
  | BooleanType
  | StringType
  | NumberType
  | NodeType
  | LiteralType
  | EnumType
  | ArrayType
  | SetType
  | ObjectType
  | MapType
  | RecordType
  | UnionType
  | IntersectionType
  | FunctionType
  | OptionalType
  | PromiseType
  | NamedType;

export interface CollectedTypes {
  [name: string]: ParameterizableType;
}

export interface ParameterizableType {
  type: ValueType;
  parameters: {
    [name: string]: ValueType | null;
  };
}

export const ANY_TYPE = { kind: "any" } as const;
export type AnyType = typeof ANY_TYPE;

export const UNKNOWN_TYPE = { kind: "unknown" } as const;
export type UnknownType = typeof UNKNOWN_TYPE;

export const NEVER_TYPE = { kind: "never" } as const;
export type NeverType = typeof NEVER_TYPE;

export const VOID_TYPE = { kind: "void" } as const;
export type VoidType = typeof VOID_TYPE;

export const NULL_TYPE = { kind: "null" } as const;
export type NullType = typeof NULL_TYPE;

export const BOOLEAN_TYPE = { kind: "boolean" } as const;
export type BooleanType = typeof BOOLEAN_TYPE;

export const STRING_TYPE = { kind: "string" } as const;
export type StringType = typeof STRING_TYPE;

export const NUMBER_TYPE = { kind: "number" } as const;
export type NumberType = typeof NUMBER_TYPE;

export const NODE_TYPE = { kind: "node" } as const;
export type NodeType = typeof NODE_TYPE;

export interface LiteralType {
  kind: "literal";
  value: string | number | boolean;
}
export function literalType(value: string | number | boolean): LiteralType {
  return {
    kind: "literal",
    value,
  };
}

export interface EnumType {
  kind: "enum";
  options: { [optionName: string]: string | number };
}
export function enumType(options: {
  [optionName: string]: string | number;
}): EnumType {
  return {
    kind: "enum",
    options,
  };
}

export interface ObjectType {
  kind: "object";
  fields: { [fieldName: string]: ValueType };
}
export function objectType(fields: {
  [fieldName: string]: ValueType;
}): ObjectType {
  return {
    kind: "object",
    fields,
  };
}
export const EMPTY_OBJECT_TYPE = objectType({});

export interface MapType {
  kind: "map";
  keys: ValueType;
  values: ValueType;
}
export function mapType(keys: ValueType, values: ValueType): MapType {
  return {
    kind: "map",
    keys,
    values,
  };
}

export interface RecordType {
  kind: "record";
  keys: ValueType;
  values: ValueType;
}
export function recordType(keys: ValueType, values: ValueType): RecordType {
  return {
    kind: "record",
    keys,
    values,
  };
}

export interface ArrayType {
  kind: "array";
  items: ValueType;
}
export function arrayType(items: ValueType): ArrayType {
  return {
    kind: "array",
    items,
  };
}

export interface SetType {
  kind: "set";
  items: ValueType;
}
export function setType(items: ValueType): SetType {
  return {
    kind: "set",
    items,
  };
}

export function tupleType(items: ValueType[]): ObjectType {
  return {
    kind: "object",
    fields: Object.fromEntries(items.map((item, i) => [i.toString(), item])),
  };
}

export interface UnionType {
  kind: "union";
  types: ValueType[];
}
export function unionType(types: ValueType[]): ValueType {
  if (types.length === 0) {
    return NEVER_TYPE;
  }
  if (types.length === 1) {
    return types[0]!;
  }
  return {
    kind: "union",
    types,
  };
}

export interface IntersectionType {
  kind: "intersection";
  types: ValueType[];
}
export function intersectionType(types: ValueType[]): ValueType {
  if (types.length === 0) {
    return ANY_TYPE;
  }
  if (types.length === 0) {
    throw new Error(`Intersection of no types is invalid.`);
  }
  if (types.length === 1) {
    return types[0]!;
  }
  return {
    kind: "intersection",
    types,
  };
}

export interface FunctionType {
  kind: "function";
  returnType: ValueType;
}
export function functionType(returnType: ValueType): FunctionType {
  return {
    kind: "function",
    returnType,
  };
}
export interface OptionalType {
  kind: "optional";
  type: ValueType;
}
export function optionalType(type: ValueType): OptionalType {
  if (type.kind === "optional") {
    return type;
  }
  return {
    kind: "optional",
    type,
  };
}
export function maybeOptionalType(
  type: ValueType,
  optional: boolean
): ValueType {
  if (type.kind === "optional") {
    return type;
  }
  if (optional) {
    return optionalType(type);
  }
  return type;
}

export interface PromiseType {
  kind: "promise";
  type: ValueType;
}
export function promiseType(type: ValueType): PromiseType {
  return {
    kind: "promise",
    type,
  };
}

export interface NamedType {
  kind: "name";
  name: string;
  args: ValueType[];
}
export function namedType(name: string, args: ValueType[] = []): ValueType {
  return {
    kind: "name",
    name,
    args,
  };
}
