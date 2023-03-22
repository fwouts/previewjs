import type { Reader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";
import {
  ANY_TYPE,
  BOOLEAN_TYPE,
  CollectedTypes,
  EMPTY_OBJECT_TYPE,
  NEVER_TYPE,
  NULL_TYPE,
  NUMBER_TYPE,
  OptionalType,
  ParameterizableType,
  STRING_TYPE,
  UNKNOWN_TYPE,
  VOID_TYPE,
  ValueType,
  arrayType,
  enumType,
  functionType,
  literalType,
  mapType,
  maybeOptionalType,
  namedType,
  objectType,
  promiseType,
  recordType,
  setType,
  tupleType,
  unionType,
} from "./definitions";
import { computeIntersection } from "./intersection";
import { stripUnusedTypes } from "./strip-unused-types";
import { typescriptServiceHost } from "./ts-service-host";
import { computeUnion } from "./union";
export type { TypeAnalyzer, TypeResolver };

export function createTypeAnalyzer(options: {
  rootDirPath: string;
  reader: Reader;
  collected?: CollectedTypes;
  tsCompilerOptions?: Partial<ts.CompilerOptions>;
  specialTypes?: Record<string, ValueType>;
  printWarnings?: boolean;
}): TypeAnalyzer {
  return new TypeAnalyzer(
    options.rootDirPath,
    options.reader,
    options.collected || {},
    options.specialTypes || {},
    options.tsCompilerOptions || {},
    options.printWarnings || false
  );
}

class TypeAnalyzer {
  private service: ts.LanguageService | null = null;
  private entryPointFilePaths: string[] = [];
  private printedWarnings = new Set<string>();

  constructor(
    private readonly rootDirPath: string,
    reader: Reader,
    private readonly collected: CollectedTypes,
    private readonly specialTypes: Record<string, ValueType>,
    tsCompilerOptions: Partial<ts.CompilerOptions>,
    private readonly printWarnings: boolean
  ) {
    this.service = ts.createLanguageService(
      typescriptServiceHost({
        rootDirPath,
        reader,
        getScriptFileNames: () => this.entryPointFilePaths,
        tsCompilerOptions,
      }),
      ts.createDocumentRegistry()
    );
  }

  analyze(filePaths: string[]) {
    if (!this.service) {
      throw new Error(`TypeAnalyzer already disposed of`);
    }
    this.entryPointFilePaths = filePaths;
    const program = this.service.getProgram();
    if (!program) {
      throw new Error(`No program available.`);
    }
    if (this.printWarnings) {
      const semanticDiagnostics = program.getSemanticDiagnostics();
      let printedSemanticWarningsHeader = false;
      let lastFileName = "";
      for (const diagnostic of semanticDiagnostics) {
        const messageText =
          typeof diagnostic.messageText === "string"
            ? diagnostic.messageText
            : diagnostic.messageText.messageText;
        if (this.printedWarnings.has(messageText)) {
          continue;
        }
        if (!printedSemanticWarningsHeader) {
          console.warn(
            "Warning: encountered some TypeScript error(s) while resolving types.\nThis may be safe to ignore, but could help point out why some components are not detected by Preview.js."
          );
          printedSemanticWarningsHeader = true;
        }
        if (diagnostic.file && lastFileName !== diagnostic.file.fileName) {
          lastFileName = diagnostic.file.fileName;
          console.warn(`${path.relative(this.rootDirPath, lastFileName)}:`);
        }
        console.warn(messageText);
        this.printedWarnings.add(messageText);
      }
    }
    return new TypeResolver(
      this.rootDirPath,
      this.collected,
      this.specialTypes,
      program,
      this.printWarnings
    );
  }

  dispose() {
    this.service?.dispose();
    this.service = null;
  }
}

class TypeResolver {
  readonly checker: ts.TypeChecker;

  constructor(
    private readonly rootDirPath: string,
    private readonly collected: CollectedTypes,
    private readonly specialTypes: Record<string, ValueType>,
    private readonly program: ts.Program,
    private readonly printWarnings: boolean
  ) {
    this.checker = program.getTypeChecker();
  }

  sourceFile(absoluteFilePath: string) {
    const sourceFile = this.program.getSourceFile(absoluteFilePath);
    if (!sourceFile) {
      return null;
    }
    return sourceFile;
  }

  resolveType(type: ts.Type) {
    const resolved = this.resolveTypeInternal(type);
    return {
      type: resolved,
      collected: stripUnusedTypes(this.collected, resolved),
    };
  }

  private resolveTypeInternal(
    type: ts.Type,
    genericTypeNames: Set<string> = new Set()
  ): ValueType {
    const aliasTypeArguments = (type.aliasTypeArguments || []).map((t) =>
      this.resolveTypeInternal(t, genericTypeNames)
    );
    const resolvedTypeArguments = this.resolveTypeArgumentsInternal(
      type,
      genericTypeNames
    );
    if (type.symbol?.name === "globalThis") {
      // globalThis is a very large object type. It seems to make everything explode.
      return EMPTY_OBJECT_TYPE;
    }
    if (
      type.aliasSymbol &&
      !this.isSpecialType(type.aliasSymbol.name) &&
      type === this.checker.getDeclaredTypeOfSymbol(type.aliasSymbol)
    ) {
      const prefix = this.extractFileNameFromSymbol(type.aliasSymbol);
      const typeName = `${prefix}:${type.aliasSymbol.name}`;
      return this.namedType(
        typeName,
        type,
        aliasTypeArguments,
        genericTypeNames
      );
    }
    if (type.isTypeParameter() && !(type as any).isThisType) {
      if (genericTypeNames.has(type.symbol.name)) {
        return namedType(type.symbol.name);
      } else {
        return UNKNOWN_TYPE;
      }
    }
    const name = this.typeNameFromSymbol(type.symbol);
    if (!name || this.isSpecialType(type.symbol.name)) {
      try {
        return this.resolveUncollectedType(type, genericTypeNames);
      } catch (e: any) {
        if (this.printWarnings) {
          console.warn(
            `Unable to resolve type ${this.checker.typeToString(type)}\n\n${
              e.stack || e.message
            }`
          );
        }
        throw e;
      }
    }
    return this.namedType(name, type, resolvedTypeArguments, genericTypeNames);
  }

  private namedType(
    name: string,
    type: ts.Type,
    args: ValueType[],
    genericTypeNames: Set<string>
  ) {
    if (name.includes("typescript")) {
      // This is a native type, we don't need to collect it.
      const typeName = name.split(":")[1] || "";
      return namedType(typeName, args);
    }
    let collected = this.collected[name];
    if (!collected) {
      // Set a temporary value until collected to avoid infinite loops.
      this.collected[name] = {
        type: namedType(name, []),
        parameters: {},
      };
      const targetType = (type as ts.TypeReference).target;
      collected = this.collected[name] = this.resolveWithParameters(
        targetType && targetType.aliasSymbol?.name === type.aliasSymbol?.name
          ? targetType
          : type,
        genericTypeNames
      );
    }
    return namedType(name, args);
  }

  private typeNameFromSymbol(symbol?: ts.Symbol): string | null {
    if (!symbol) {
      return null;
    }
    // This is not a type alias, but it could still have a name.
    // For example, an interface such as:
    // interface A {}
    const prefix = this.extractFileNameFromSymbol(symbol);
    if (symbol.name !== "__type" && symbol.flags & ts.SymbolFlags.Type) {
      return `${prefix}:${symbol.name}`;
    }
    return null;
  }

  private resolveWithParameters(
    type: ts.Type,
    genericTypeNames: Set<string>
  ): ParameterizableType {
    const parameters: { [name: string]: ValueType | null } = {};
    // Important: make a copy so we can mutate it independently.
    genericTypeNames = new Set(genericTypeNames);
    for (const parameter of getTypeParameters(type)) {
      const defaultValue: ValueType | null = parameter.default
        ? this.resolveTypeInternal(
            this.checker.getTypeFromTypeNode(parameter.default),
            genericTypeNames
          )
        : null;
      const parameterName = parameter.name.text;
      parameters[parameterName] = defaultValue;
      genericTypeNames.add(parameterName);
    }
    return {
      type: this.resolveUncollectedType(type, genericTypeNames),
      parameters,
    };
  }

  private isSpecialType(typeName: string) {
    switch (typeName) {
      case "Array":
      case "Map":
      case "Promise":
      case "Set":
      case "Readonly":
      case "Record":
        return true;
      default:
        return Object.keys(this.specialTypes).includes(typeName);
    }
  }

  private resolveUncollectedType(
    type: ts.Type,
    genericTypeNames: Set<string>
  ): ValueType {
    const specialTypeNames = Object.keys(this.specialTypes);
    const typeArguments = (
      this.checker.getTypeArguments(type as ts.TypeReference) || []
    ).map((t) => this.resolveTypeInternal(t, genericTypeNames));
    if (type.symbol?.name && specialTypeNames.includes(type.symbol.name)) {
      return this.specialTypes[type.symbol.name]!;
    }
    if (
      type.aliasSymbol?.name &&
      specialTypeNames.includes(type.aliasSymbol.name)
    ) {
      return this.specialTypes[type.aliasSymbol.name]!;
    }
    if (type.symbol?.name === "Array") {
      return arrayType(typeArguments[0] || UNKNOWN_TYPE);
    }
    if (type.symbol?.name === "Map") {
      return mapType(
        typeArguments[0] || UNKNOWN_TYPE,
        typeArguments[1] || UNKNOWN_TYPE
      );
    }
    if (type.symbol?.name === "Promise") {
      return promiseType(typeArguments[0] || UNKNOWN_TYPE);
    }
    if (type.symbol?.name === "Readonly") {
      return typeArguments[0] || UNKNOWN_TYPE;
    }
    if (type.symbol?.name === "Record") {
      return recordType(
        typeArguments[0] || UNKNOWN_TYPE,
        typeArguments[1] || UNKNOWN_TYPE
      );
    }
    if (type.symbol?.name === "Set") {
      return setType(typeArguments[0] || UNKNOWN_TYPE);
    }
    const flags = type.getFlags();
    if (flags & ts.TypeFlags.Any) {
      return ANY_TYPE;
    }
    if (flags & ts.TypeFlags.Unknown) {
      return UNKNOWN_TYPE;
    }
    if (flags & ts.TypeFlags.Never) {
      return NEVER_TYPE;
    }
    if (flags & ts.TypeFlags.Boolean) {
      return BOOLEAN_TYPE;
    }
    if (flags & ts.TypeFlags.String) {
      return STRING_TYPE;
    }
    if (flags & ts.TypeFlags.Number) {
      return NUMBER_TYPE;
    }
    if (flags & ts.TypeFlags.Void) {
      return VOID_TYPE;
    }
    if (flags & ts.TypeFlags.Undefined) {
      return VOID_TYPE;
    }
    if (flags & ts.TypeFlags.Null) {
      return NULL_TYPE;
    }
    if (flags & ts.TypeFlags.BooleanLiteral) {
      const intrinsicName = (type as any).intrinsicName;
      switch (intrinsicName) {
        case "false":
          return literalType(false);
        case "true":
          return literalType(true);
        default:
          throw new Error(
            `Boolean literal type with unexpected intrinsic name: ${intrinsicName}`
          );
      }
    }
    if (type.isStringLiteral() || type.isNumberLiteral()) {
      return literalType(type.value);
    }
    if (
      flags & ts.TypeFlags.EnumLiteral &&
      type.aliasSymbol &&
      type.aliasSymbol.exports
    ) {
      const options: { [optionName: string]: string | number } = {};
      let error = false;
      type.aliasSymbol.exports.forEach((value, key) => {
        if (!value.valueDeclaration) {
          error = true;
          return;
        }
        const enumFieldType = this.checker.getTypeAtLocation(
          value.valueDeclaration
        );
        if (
          !enumFieldType.isStringLiteral() &&
          !enumFieldType.isNumberLiteral()
        ) {
          error = true;
          return;
        }
        options[key.toString()] = enumFieldType.value;
      });
      if (error) {
        throw new Error(
          `Unexpected enum type: ${this.checker.typeToString(type)}`
        );
      }
      return enumType(options);
    }
    if (type.isUnionOrIntersection()) {
      const subtypes: ValueType[] = [];
      for (const t of type.types) {
        const subtype = this.resolveTypeInternal(t, genericTypeNames);
        if (!subtype) {
          if (this.printWarnings) {
            console.warn(
              `Unable to resolve ${
                type.isUnion() ? "union" : "intersection"
              } subtype ${this.checker.typeToString(t)}`
            );
          }
          return UNKNOWN_TYPE;
        }
        subtypes.push(subtype);
      }
      return type.isUnion()
        ? computeUnion(subtypes)
        : computeIntersection(subtypes);
    }
    const callSignatures = type.getCallSignatures();
    // Note: for a React component, we don't expect more than one call signature.
    if (callSignatures.length > 0) {
      const callSignature = callSignatures[0]!;
      return functionType(
        this.resolveTypeInternal(
          callSignature.getReturnType(),
          genericTypeNames
        )
      );
    }
    const arrayItemType = type.getNumberIndexType();
    if (arrayItemType) {
      const tupleTypes: ValueType[] = [];
      while (type.getProperty(tupleTypes.length.toString())) {
        tupleTypes.push(typeArguments[tupleTypes.length] || UNKNOWN_TYPE);
      }
      if (tupleTypes.length > 0) {
        return tupleType(tupleTypes);
      }
      return arrayType(
        this.resolveTypeInternal(arrayItemType, genericTypeNames)
      );
    }
    if (flags & ts.TypeFlags.Object) {
      const indexType = type.getStringIndexType();
      if (indexType) {
        return recordType(
          STRING_TYPE,
          this.resolveTypeInternal(indexType, genericTypeNames)
        );
      }
      const fields: Record<string, ValueType | OptionalType> = {};
      for (const property of type.getProperties()) {
        const [propertyName, ...nestedPath] = property.name.split(".");
        if (nestedPath.length > 0) {
          // For now, we ignore property names such as "foo.bar".
          continue;
        }
        if (
          !propertyName ||
          propertyName.startsWith("__@") ||
          propertyName.startsWith("#")
        ) {
          continue;
        }
        let propertyTsType: ts.Type | undefined;
        if (
          property.valueDeclaration &&
          ts.canHaveModifiers(property.valueDeclaration) &&
          property.valueDeclaration?.modifiers?.find(
            (m) =>
              m.kind === ts.SyntaxKind.PrivateKeyword ||
              m.kind === ts.SyntaxKind.ProtectedKeyword
          )
        ) {
          continue;
        }
        if (
          property.valueDeclaration &&
          ts.isPropertySignature(property.valueDeclaration) &&
          property.valueDeclaration.type
        ) {
          const declaredType = this.checker.getTypeFromTypeNode(
            property.valueDeclaration.type
          );
          if (
            !(declaredType.flags & ts.TypeFlags.TypeParameter) &&
            !declaredType.aliasTypeArguments?.length &&
            // @ts-ignore
            !declaredType.resolvedTypeArguments?.length
          ) {
            propertyTsType = declaredType;
          }
        }
        if (!propertyTsType) {
          // @ts-ignore
          propertyTsType = this.checker.getTypeOfPropertyOfType(
            type,
            property.name
          );
        }
        let fieldType = propertyTsType
          ? this.resolveTypeInternal(propertyTsType, genericTypeNames)
          : UNKNOWN_TYPE;
        const optional = Boolean(property.flags & ts.SymbolFlags.Optional);
        if (optional) {
          if (fieldType.kind === "union") {
            fieldType = unionType(
              fieldType.types.filter((t) => t.kind !== "void")
            );
          }
        }
        fields[propertyName!] = maybeOptionalType(fieldType, optional);
      }
      return objectType(fields);
    }
    if (this.printWarnings) {
      console.warn(
        `Unable to recognise type with flags ${flags} in ${this.checker.typeToString(
          type
        )}`
      );
    }
    return UNKNOWN_TYPE;
  }

  private extractFileNameFromSymbol(symbol: ts.Symbol, suffix = ""): string {
    const parent = (symbol as any).parent as ts.Symbol | undefined;
    const declaration =
      symbol.valueDeclaration ||
      (symbol.declarations && symbol.declarations[0]);
    if (declaration) {
      return this.extractFileNameFromDeclaration(declaration, suffix);
    }
    if (parent && parent.flags & ts.SymbolFlags.ValueModule) {
      suffix += ":" + parent.escapedName;
    }
    if (parent) {
      return this.extractFileNameFromSymbol(parent, suffix);
    } else {
      return suffix;
    }
  }

  private extractFileNameFromDeclaration(
    declaration: ts.Node,
    suffix = ""
  ): string {
    if (ts.isSourceFile(declaration)) {
      return path.relative(this.rootDirPath, declaration.fileName) + suffix;
    } else if (ts.isModuleDeclaration(declaration)) {
      suffix += ":" + declaration.name.text;
    }
    if (declaration.parent) {
      return this.extractFileNameFromDeclaration(declaration.parent, suffix);
    } else {
      return suffix;
    }
  }

  resolveTypeArguments(
    type: ts.Type,
    genericTypeNames: Set<string> = new Set()
  ): {
    types: ValueType[];
    collected: CollectedTypes;
  } {
    return {
      types: this.resolveTypeArgumentsInternal(type, genericTypeNames),
      collected: this.collected,
    };
  }

  private resolveTypeArgumentsInternal(
    type: ts.Type,
    genericTypeNames: Set<string>
  ): ValueType[] {
    return ((type as any).resolvedTypeArguments || []).map((t: ts.Type) =>
      this.resolveTypeInternal(t, genericTypeNames)
    );
  }
}

function getTypeParameters(type: ts.Type): ts.TypeParameterDeclaration[] {
  return (
    (type.isClassOrInterface()
      ? type.typeParameters
      : type.aliasSymbol
      ? type.aliasTypeArguments
      : []) || []
  )
    .filter((t) => t.isTypeParameter())
    .map((parameter) => {
      const declaration = (parameter.symbol.declarations || [])[0];
      if (!declaration || !ts.isTypeParameterDeclaration(declaration)) {
        throw new Error(
          `Could not find declaration for parameter ${parameter.symbol.name}`
        );
      }
      return declaration;
    });
}
