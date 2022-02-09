import {
  createTypescriptAnalyzer,
  TypescriptAnalyzer,
} from "@previewjs/core/ts-helpers";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
  Reader,
  Writer,
} from "@previewjs/core/vfs";
import {
  ANY_TYPE,
  arrayType,
  BOOLEAN_TYPE,
  createTypeAnalyzer,
  enumType,
  functionType,
  intersectionType,
  literalType,
  mapType,
  namedType,
  NODE_TYPE,
  NULL_TYPE,
  NUMBER_TYPE,
  objectType,
  optionalType,
  promiseType,
  recordType,
  setType,
  STRING_TYPE,
  tupleType,
  unionType,
  UNKNOWN_TYPE,
  VOID_TYPE,
} from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";

describe("TypeAnalyzer", () => {
  let memoryReader: Reader & Writer;
  let typescriptAnalyzer: TypescriptAnalyzer;

  beforeEach(() => {
    memoryReader = createMemoryReader();
    typescriptAnalyzer = createTypescriptAnalyzer({
      rootDirPath: path.join(__dirname, "virtual"),
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader(), // required for TypeScript libs, e.g. Promise
      ]),
    });
  });

  afterEach(() => {
    typescriptAnalyzer.dispose();
  });

  test("string", async () => {
    expect(resolveType(`type A = string;`, "A")).toEqual([STRING_TYPE, {}]);
  });

  test("nullable string", async () => {
    expect(resolveType(`type A = string | null;`, "A")).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: unionType([NULL_TYPE, STRING_TYPE]),
          parameters: {},
        },
      },
    ]);
  });

  test("number", async () => {
    expect(resolveType(`type A = number;`, "A")).toEqual([NUMBER_TYPE, {}]);
  });

  test("boolean", async () => {
    expect(resolveType(`type A = boolean;`, "A")).toEqual([BOOLEAN_TYPE, {}]);
  });

  test("null", async () => {
    expect(resolveType(`type A = null;`, "A")).toEqual([NULL_TYPE, {}]);
  });

  test("undefined", async () => {
    expect(resolveType(`type A = undefined;`, "A")).toEqual([VOID_TYPE, {}]);
  });

  test("void", async () => {
    expect(resolveType(`type A = void;`, "A")).toEqual([VOID_TYPE, {}]);
  });

  test("literal", async () => {
    expect(resolveType(`type A = 123;`, "A")).toEqual([literalType(123), {}]);
    expect(resolveType(`type A = "foo";`, "A")).toEqual([
      literalType("foo"),
      {},
    ]);
    expect(resolveType(`type A = true;`, "A")).toEqual([literalType(true), {}]);
    expect(resolveType(`type A = false;`, "A")).toEqual([
      literalType(false),
      {},
    ]);
  });

  test("array via brackets", async () => {
    expect(
      resolveType(
        `
type A = string[];
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: arrayType(STRING_TYPE),
          parameters: {},
        },
      },
    ]);
  });

  test("array via generic type", async () => {
    expect(
      resolveType(
        `
type A = Array<string>;
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: arrayType(STRING_TYPE),
          parameters: {},
        },
      },
    ]);
  });

  test("array of interface", async () => {
    expect(
      resolveType(
        `
type A = B[];

interface B {
  foo: string;
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: arrayType(namedType("main.ts:B")),
          parameters: {},
        },
        "main.ts:B": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("set with generic type", async () => {
    expect(
      resolveType(
        `
type A = Set<string>;
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: setType(STRING_TYPE),
          parameters: {},
        },
      },
    ]);
  });

  test("tuple", async () => {
    expect(
      resolveType(
        `
type A = [string, number];
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: tupleType([STRING_TYPE, NUMBER_TYPE]),
          parameters: {},
        },
      },
    ]);
  });

  test("readonly type", async () => {
    expect(
      resolveType(
        `
type A = Readonly<B>;

type B = {
  name: string;
};
`,
        "A"
      )
    ).toEqual([
      objectType({
        name: STRING_TYPE,
      }),
      {
        "main.ts:B": {
          type: objectType({
            name: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("promise type", async () => {
    expect(
      resolveType(
        `
type A = Promise<B>;

type B = {
  name: Promise<string>;
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: promiseType(namedType("main.ts:B")),
          parameters: {},
        },
        "main.ts:B": {
          type: objectType({
            name: promiseType(STRING_TYPE),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("complex types within object", async () => {
    expect(
      resolveType(
        `
type A = {
  arrayBrackets: string[],
  arrayGeneric: Array<string>,
  promise: Promise<string>,
  set: Set<string>
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            arrayBrackets: arrayType(STRING_TYPE),
            arrayGeneric: arrayType(STRING_TYPE),
            promise: promiseType(STRING_TYPE),
            set: setType(STRING_TYPE),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("object via type alias", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: string,
  bar?: number,
  baz: string[]
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: STRING_TYPE,
            bar: optionalType(NUMBER_TYPE),
            baz: arrayType(STRING_TYPE),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("object via interface", async () => {
    expect(
      resolveType(
        `
interface A {
  foo: string,
  bar?: number,
  baz: B[]
};

interface B {
  foo: number
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: STRING_TYPE,
            bar: optionalType(NUMBER_TYPE),
            baz: arrayType(namedType("main.ts:B")),
          }),
          parameters: {},
        },
        ["main.ts:B"]: {
          type: objectType({
            foo: NUMBER_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("nested anonymous object", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: {
    bar: string
  }
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: objectType({
              bar: STRING_TYPE,
            }),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("type transform with alias", async () => {
    expect(
      resolveType(
        `
type A = Pick<B, 'a' | 'c'>;

interface B {
  a: string,
  b: string,
  c: string
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: STRING_TYPE,
            c: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("type transform within object", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: Pick<B, 'a' | 'c'>;
}

interface B {
  a: string,
  b: string,
  c: string
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: objectType({
              a: STRING_TYPE,
              c: STRING_TYPE,
            }),
          }),
          parameters: {},
        },
        ["main.ts:B"]: {
          type: objectType({
            a: STRING_TYPE,
            b: STRING_TYPE,
            c: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("type transform + generic within object", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: Pick<B<number>, 'a' | 'c'>;
}

interface B<T, S = T> {
  a: T,
  b: string,
  c: S
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: objectType({
              a: NUMBER_TYPE,
              c: NUMBER_TYPE,
            }),
          }),
          parameters: {},
        },
        ["main.ts:B"]: {
          type: objectType({
            a: namedType("T"),
            b: STRING_TYPE,
            c: namedType("S"),
          }),
          parameters: {
            T: null,
            S: namedType("T"),
          },
        },
      },
    ]);
  });

  test("named object union", async () => {
    expect(
      resolveType(
        `
type A = B | C<number>;

interface B {
  kind: "b",
  value: string,
}

interface C<T> {
  kind: "c",
  value: T,
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: unionType([
            namedType("main.ts:B"),
            namedType("main.ts:C", [NUMBER_TYPE]),
          ]),
          parameters: {},
        },
        ["main.ts:B"]: {
          type: objectType({
            kind: literalType("b"),
            value: STRING_TYPE,
          }),
          parameters: {},
        },
        ["main.ts:C"]: {
          type: objectType({
            kind: literalType("c"),
            value: namedType("T"),
          }),
          parameters: {
            T: null,
          },
        },
      },
    ]);
  });

  test("union with undefined first", () => {
    expect(
      resolveType(
        `
type A = undefined | B;

type B = {
  foo: string;
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: optionalType(namedType("main.ts:B")),
          parameters: {},
        },
        "main.ts:B": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("union with undefined second", () => {
    expect(
      resolveType(
        `
type A = B | undefined;

type B = {
  foo: string;
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: optionalType(namedType("main.ts:B")),
          parameters: {},
        },
        "main.ts:B": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("union with undefined and undefined", () => {
    expect(
      resolveType(
        `
type A = undefined | undefined;
`,
        "A"
      )
    ).toEqual([VOID_TYPE, {}]);
  });

  test("union with null and undefined", () => {
    expect(
      resolveType(
        `
type A = null | B | undefined;

type B = {
foo: string;
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: optionalType(unionType([NULL_TYPE, namedType("main.ts:B")])),
          parameters: {},
        },
        "main.ts:B": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("union with missing type", () => {
    expect(
      resolveType(
        `
type A = { foo: "foo" } | B;
`,
        "A"
      )
    ).toEqual([ANY_TYPE, {}]);
  });

  test("union with generic type", () => {
    expect(
      resolveType(
        `
type A = B<string>;

type B<T> = { foo: "foo" } | C<T>;

type C<T> = {
  bar: T
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: unionType([
            objectType({
              foo: literalType("foo"),
            }),
            objectType({
              bar: STRING_TYPE,
            }),
          ]),
          parameters: {},
        },
      },
    ]);
  });

  test("heterogenous type union", async () => {
    expect(
      resolveType(
        `
type A = { foo: "foo" } | { bar : "bar" } | string[];
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: unionType([
            objectType({ foo: literalType("foo") }),
            objectType({ bar: literalType("bar") }),
            arrayType(STRING_TYPE),
          ]),
          parameters: {},
        },
      },
    ]);
  });

  test("function type union", async () => {
    expect(
      resolveType(
        `
type A = (() => { foo: "foo" }) | ((args: any[]) => { bar: "bar" });
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: functionType(
            unionType([
              objectType({ foo: literalType("foo") }),
              objectType({ bar: literalType("bar") }),
            ])
          ),
          parameters: {},
        },
      },
    ]);
  });

  test("named object intersection", async () => {
    expect(
      resolveType(
        `
type A = B & C<number>;

interface B {
  b: string,
}

interface C<T> {
  c: T,
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: intersectionType([
            namedType("main.ts:B"),
            namedType("main.ts:C", [NUMBER_TYPE]),
          ]),
          parameters: {},
        },
        ["main.ts:B"]: {
          type: objectType({
            b: STRING_TYPE,
          }),
          parameters: {},
        },
        ["main.ts:C"]: {
          type: objectType({
            c: namedType("T"),
          }),
          parameters: {
            T: null,
          },
        },
      },
    ]);
  });

  test("intersection with empty anonymous types", () => {
    expect(
      resolveType(
        `
type A = {} & {};
`,
        "A"
      )
    ).toEqual([objectType({}), {}]);
  });

  test("intersection with empty named types", () => {
    expect(
      resolveType(
        `
type A = B & C;

type B = {};

type C = {};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:B"),
      {
        "main.ts:B": {
          type: objectType({}),
          parameters: {},
        },
      },
    ]);
  });

  test("intersection with missing type", () => {
    expect(
      resolveType(
        `
type A = { foo: "foo" } & B;
`,
        "A"
      )
    ).toEqual([ANY_TYPE, {}]);
  });

  test("intersection with generic type", () => {
    expect(
      resolveType(
        `
type A = B<string>;

type B<T> = { foo: "foo" } & C<T>;

type C<T> = {
  bar: T
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: objectType({
            foo: literalType("foo"),
            bar: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("heterogenous type intersection", async () => {
    expect(
      resolveType(
        `
type A = { foo: "foo" } & { bar : "bar" } & string[];
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: intersectionType([
            objectType({ foo: literalType("foo") }),
            objectType({ bar: literalType("bar") }),
            arrayType(STRING_TYPE),
          ]),
          parameters: {},
        },
      },
    ]);
  });

  test("function type intersection", async () => {
    expect(
      resolveType(
        `
type A = (() => { foo: "foo" }) & ((args: any[]) => { bar: "bar" });
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: functionType(
            objectType({ foo: literalType("foo"), bar: literalType("bar") })
          ),
          parameters: {},
        },
      },
    ]);
  });

  test("string & {} intersection", async () => {
    expect(
      resolveType(
        `
type A = ("foo" | "bar") | string & {}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: unionType([
            literalType("foo"),
            literalType("bar"),
            STRING_TYPE,
          ]),
          parameters: {},
        },
      },
    ]);
  });

  test("enum with default values", async () => {
    expect(
      resolveType(
        `
enum A {
  FOO,
  BAR
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: enumType({
            FOO: 0,
            BAR: 1,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("enum with explicit number values", async () => {
    expect(
      resolveType(
        `
enum A {
  FOO = 2,
  BAR = 4.3
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: enumType({
            FOO: 2,
            BAR: 4.3,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("enum with explicit string values", async () => {
    expect(
      resolveType(
        `
enum A {
  FOO = "foo",
  BAR = "bar"
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: enumType({
            FOO: "foo",
            BAR: "bar",
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("function type", async () => {
    expect(
      resolveType(
        `
type A = () => number;
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: functionType(NUMBER_TYPE),
          parameters: {},
        },
      },
    ]);
  });

  test("generic function type", async () => {
    expect(
      resolveType(
        `
interface A {
  foo<T>(): T,
  bar<T>(a: T): T,
  baz<T>(a: T): { baz: T },
  qux<T>(): B<T>
}

type B<T> = {
  foo: T[string];
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: functionType(UNKNOWN_TYPE),
            bar: functionType(UNKNOWN_TYPE),
            baz: functionType(
              objectType({
                baz: UNKNOWN_TYPE,
              })
            ),
            qux: functionType(
              objectType({
                foo: UNKNOWN_TYPE,
              })
            ),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("string indexed type", async () => {
    expect(
      resolveType(
        `
type A = {
  [key: string]: number
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: recordType(STRING_TYPE, NUMBER_TYPE),
          parameters: {},
        },
      },
    ]);
  });

  test("literal indexed type", async () => {
    expect(
      resolveType(
        `
type A = {
  [key in K]: string
};

type K = 'a' | 'b';
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: STRING_TYPE,
            b: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("string indexed type value", async () => {
    expect(
      resolveType(
        `
type A = B[string];

type B = {
  [key: string]: "foo"
};
`,
        "A"
      )
    ).toEqual([literalType("foo"), {}]);
  });

  test("record type", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: Record<string, number>
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: recordType(STRING_TYPE, NUMBER_TYPE),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("map type", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: Map<string, number>
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            foo: mapType(STRING_TYPE, NUMBER_TYPE),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("recursive type alias type", async () => {
    expect(
      resolveType(
        `
type A = {
  value: string,
  child?: A[]
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            value: STRING_TYPE,
            child: optionalType(arrayType(namedType("main.ts:A"))),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("recursive interface type", async () => {
    expect(
      resolveType(
        `
interface A {
  value: string,
  child?: A[]
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            value: STRING_TYPE,
            child: optionalType(arrayType(namedType("main.ts:A"))),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("recursive class type", async () => {
    expect(
      resolveType(
        `
class A {
  self: A;

  who() {
    return this;
  }
}
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            self: namedType("main.ts:A"),
            who: functionType(namedType("main.ts:A")),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("generic interface type", async () => {
    expect(
      resolveType(
        `
type A = B<number>;

interface B<T> {
  a: T,
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: NUMBER_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("generic interface type with optional type parameter", async () => {
    expect(
      resolveType(
        `
type A = B<number>;

interface B<T, S = T> {
  a: T,
  b: S
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: NUMBER_TYPE,
            b: NUMBER_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("generic type alias", async () => {
    expect(
      resolveType(
        `
type A = B<number>;

type B<T, S = T> = {
  a: T,
  b: S
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: NUMBER_TYPE,
            b: NUMBER_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("type alias generics", async () => {
    expect(
      resolveType(
        `
type A = {
  foo: B<string>;
}

type B<Value> = {
  bar: Array<Value>;
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: objectType({
            foo: objectType({
              bar: arrayType(STRING_TYPE),
            }),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("complex generics", async () => {
    expect(
      resolveType(
        `
class A {
  restaurantList: Atom<string[]>;
}

declare type Atom<Value> = {
  read: Read<Value>;
};

declare type Read<Value> = (get: Getter) => Value | Promise<Value>;

declare type Getter = {
  <Value>(atom: Atom<Value | Promise<Value>>): Value;
  <Value>(atom: Atom<Promise<Value>>): Value;
  <Value>(atom: Atom<Value>): Value;
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            restaurantList: objectType({
              read: functionType(
                unionType([
                  arrayType(STRING_TYPE),
                  promiseType(arrayType(STRING_TYPE)),
                ])
              ),
            }),
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("instantiated generic type", async () => {
    expect(
      resolveType(
        `
type A = B<number>;

interface B<T> {
  a: T,
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: NUMBER_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("recursive generic type", async () => {
    expect(
      resolveType(
        `
type A = B<number>;

interface B<T> {
  self: B<T>,
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        "main.ts:A": {
          type: objectType({
            self: namedType("main.ts:B", [NUMBER_TYPE]),
          }),
          parameters: {},
        },
        "main.ts:B": {
          type: objectType({
            self: namedType("main.ts:B", [namedType("T")]),
          }),
          parameters: {
            T: null,
          },
        },
      },
    ]);
  });

  test("instantiated generic type with optional type parameter", async () => {
    expect(
      resolveType(
        `
type A = B<number>;

interface B<T, S = T> {
  a: T,
  b: S
};
`,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: NUMBER_TYPE,
            b: NUMBER_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("imported type", async () => {
    expect(
      resolveType(
        `
import { B } from './other';

type A = B;
`,
        "A",
        {
          "other.ts": `export type B = string;`,
        }
      )
    ).toEqual([STRING_TYPE, {}]);
  });

  test("imported type with aliased path", async () => {
    expect(
      resolveType(
        `
import { B } from 'foo/other';

type A = B;
`,
        "A",
        {
          "tsconfig.json": JSON.stringify({
            compilerOptions: {
              paths: {
                "foo/*": ["bar/*"],
              },
            },
          }),
          "bar/other.ts": `export type B = string;`,
        }
      )
    ).toEqual([STRING_TYPE, {}]);
  });

  // Note: the following two tests are disabled because they
  // don't work, possibly because of the virtual file system.
  test.skip("imported type with top-level base URL path", async () => {
    expect(
      resolveType(
        `
import { B } from 'bar/other';

type A = B;
`,
        "A",
        {
          "tsconfig.json": JSON.stringify({
            compilerOptions: {
              baseUrl: ".",
            },
          }),
          "bar/other.ts": `export type B = string;`,
        }
      )
    ).toEqual([STRING_TYPE, {}]);
  });

  test.skip("imported type with nested base URL path", async () => {
    expect(
      resolveType(
        `
import { B } from 'other';

type A = B;
`,
        "A",
        {
          "tsconfig.json": JSON.stringify({
            compilerOptions: {
              baseUrl: "bar",
            },
          }),
          "bar/other.ts": `export type B = string;`,
        }
      )
    ).toEqual([STRING_TYPE, {}]);
  });

  test("identically named types", async () => {
    expect(
      resolveType(
        `
import * as other from './other';

export interface A {
  a: other.A,
  b: other.B,
  c: other.C[],
  d?: other.D
};
`,
        "A",
        {
          "other.ts": `
import * as original from './main';

export interface A {
  foo: string;
};
export type B = number;
export type C = A;
export type D = original.A;
`,
        }
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        [`main.ts:A`]: {
          type: objectType({
            a: namedType(`other.ts:A`),
            b: NUMBER_TYPE,
            c: arrayType(namedType(`other.ts:A`)),
            d: optionalType(namedType(`main.ts:A`)),
          }),
          parameters: {},
        },
        [`other.ts:A`]: {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("namespaces", async () => {
    expect(
      resolveType(
        `
import './other';

export interface A {
  a: NS.B
};
`,
        "A",
        {
          "other.ts": `
namespace NS {
  export interface B {
    foo: string;
  };
}
`,
        }
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: namedType("other.ts:NS:B"),
          }),
          parameters: {},
        },
        ["other.ts:NS:B"]: {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("modules", async () => {
    expect(
      resolveType(
        `
import './other';
import { B } from "my-module";

export interface A {
  a: B
};
`,
        "A",
        {
          "other.ts": `
declare module "my-module" {
  export interface B {
    foo: string;
  };
}
`,
        }
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            a: namedType("other.ts:my-module:B"),
          }),
          parameters: {},
        },
        ["other.ts:my-module:B"]: {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  test("Special types", async () => {
    expect(
      resolveType(
        `
  import React from "react";

  interface A {
    componentType: React.ComponentType,
    component: React.Component,
  }
  `,
        "A"
      )
    ).toEqual([
      namedType("main.ts:A"),
      {
        ["main.ts:A"]: {
          type: objectType({
            componentType: functionType(NODE_TYPE),
            component: NODE_TYPE,
          }),
          parameters: {},
        },
      },
    ]);
  });

  function resolveType(
    source: string,
    name: string,
    additionalFiles: { [relativeFilePath: string]: string } = {}
  ) {
    const rootDirPath = path.join(__dirname, "virtual");
    const mainSourceFilePath = path.join(rootDirPath, "main.ts");
    memoryReader.updateFile(mainSourceFilePath, source);
    for (const [relativeFilePath, content] of Object.entries(additionalFiles)) {
      memoryReader.updateFile(
        path.join(rootDirPath, relativeFilePath),
        content
      );
    }
    const typeResolver = createTypeAnalyzer(
      rootDirPath,
      typescriptAnalyzer.analyze([mainSourceFilePath]),
      {},
      {
        Component: NODE_TYPE,
        ComponentType: functionType(NODE_TYPE),
      }
    );
    const sourceFile = typeResolver.sourceFile(mainSourceFilePath);
    if (!sourceFile) {
      throw new Error(`No source file found`);
    }
    const typeNode = getTypeNodeByName(sourceFile, name);
    const type = typeResolver.checker.getTypeAtLocation(typeNode);
    const resolved = typeResolver.resolveType(type);
    return [resolved.type, resolved.collected];
  }
});

function getTypeNodeByName(sourceFile: ts.SourceFile, name: string) {
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
    if (ts.isClassDeclaration(statement) && statement.name?.text === name) {
      return statement;
    }
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
    if (ts.isEnumDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
  }
  throw new Error(`No type named ${name}.`);
}
