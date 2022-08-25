import type { Component, ComponentAnalysis } from "@previewjs/core";
import { extractCsf3Stories } from "@previewjs/csf3";
import { helpers, TypeResolver, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import ts from "typescript";

export function extractVueComponents(
  resolver: TypeResolver,
  absoluteFilePath: string,
  options: {
    offset?: number;
  } = {}
): Component[] {
  const sourceFile = resolver.sourceFile(absoluteFilePath);
  if (!sourceFile) {
    return [];
  }

  const functions: Array<[string, ts.Statement, ts.Node]> = [];
  for (const statement of sourceFile.statements) {
    if (options.offset !== undefined) {
      if (
        options.offset < statement.getFullStart() ||
        options.offset > statement.getEnd()
      ) {
        continue;
      }
    }
    if (ts.isExportAssignment(statement)) {
      if (ts.isIdentifier(statement.expression)) {
        // Avoid duplicates.
        continue;
      }
      functions.push(["default", statement, statement.expression]);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        functions.push([
          declaration.name.text,
          statement,
          declaration.initializer,
        ]);
      }
    } else if (ts.isFunctionDeclaration(statement)) {
      const isDefaultExport =
        !!statement.modifiers?.find(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword
        ) &&
        !!statement.modifiers?.find(
          (m) => m.kind === ts.SyntaxKind.DefaultKeyword
        );
      const name = statement.name?.text;
      if (isDefaultExport || name) {
        functions.push([name || "default", statement, statement]);
      }
    }
  }

  const components: Component[] = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = helpers.extractArgs(sourceFile);
  // TODO: Handle JSX and Storybook stories.
  const analysis: ComponentAnalysis = {
    propsType: UNKNOWN_TYPE,
    types: {},
  };
  for (const [name, statement, node] of functions) {
    const hasArgs = !!args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    const signature = extractVueComponent(resolver.checker, node, hasArgs);
    if (signature) {
      components.push({
        absoluteFilePath,
        name,
        isStory: hasArgs,
        exported: isExported,
        offsets: [[statement.getFullStart(), statement.getEnd()]],
        analyze: async () => analysis,
      });
    }
  }

  return [...components, ...extractCsf3Stories(absoluteFilePath, sourceFile)];
}

function extractVueComponent(
  checker: ts.TypeChecker,
  node: ts.Node,
  hasArgs: boolean
): ts.Signature | null {
  const type = checker.getTypeAtLocation(node);
  for (const callSignature of type.getCallSignatures()) {
    const returnType = callSignature.getReturnType();
    if (isJsxElement(returnType)) {
      // JSX component.
      return callSignature;
    }
    if (returnType.getProperty("template") || hasArgs) {
      // This is a story.
      return callSignature;
    }
  }
  return null;
}

const jsxElementTypes = new Set(["Element"]);
function isJsxElement(type: ts.Type): boolean {
  if (type.isUnion()) {
    for (const subtype of type.types) {
      if (isJsxElement(subtype)) {
        return true;
      }
    }
  }
  return jsxElementTypes.has(type.symbol?.getEscapedName().toString());
}
