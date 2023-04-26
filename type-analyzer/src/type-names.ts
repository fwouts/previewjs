// Source: https://github.com/microsoft/TypeScript/issues/2536#issuecomment-87194347
const TYPESCRIPT_KEYWORDS = [
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "as",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
  "any",
  "boolean",
  "constructor",
  "declare",
  "get",
  "module",
  "require",
  "number",
  "set",
  "string",
  "symbol",
  "type",
  "from",
  "of",
];

export function safeTypeName(
  fullTypeName: string,
  typeNameMapping: {
    [name: string]: string;
  }
) {
  const existingName = typeNameMapping[fullTypeName];
  if (existingName) {
    return existingName;
  }
  const typeName = fullTypeName.split(":")[1]!;
  if (!typeName) {
    // This is a generic type name.
    return fullTypeName;
  }
  let i = 1;
  const existingTypeNames = new Set([
    ...Object.values(typeNameMapping),
    ...TYPESCRIPT_KEYWORDS,
  ]);
  while (existingTypeNames.has(numberedName(typeName, i))) {
    i++;
  }
  const result = numberedName(typeName, i);
  typeNameMapping[fullTypeName] = result;
  return result;
}

function numberedName(typeName: string, i: number) {
  return `${typeName}${i === 1 ? "" : `_${i}`}`;
}
