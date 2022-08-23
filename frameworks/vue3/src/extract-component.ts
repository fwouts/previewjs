import type { Component } from "@previewjs/core";
import { extractCsf3Stories, extractDefaultComponent } from "@previewjs/csf3";
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
  const storiesDefaultComponent = extractDefaultComponent(
    resolver.checker,
    sourceFile
  );

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
    if (ts.isVariableStatement(statement)) {
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
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.push([statement.name.text, statement, statement]);
    }
  }

  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = helpers.extractArgs(sourceFile);
  const components: Component[] = [];
  for (const [name, statement, node] of functions) {
    const exported = !!nameToExportedName[name];
    const hasArgs = !!args[name];
    const signature = extractVueComponent(resolver.checker, node, hasArgs);
    if (signature) {
      components.push({
        absoluteFilePath,
        name,
        offsets: [[statement.getFullStart(), statement.getEnd()]],
        info:
          storiesDefaultComponent && hasArgs && exported
            ? {
                kind: "story",
                associatedComponent: storiesDefaultComponent,
              }
            : {
                kind: "component",
                exported,
                // TODO: Handle JSX components.
                analyze: async () => ({
                  propsType: UNKNOWN_TYPE,
                  types: {},
                }),
              },
      });
    }
  }

  return [
    ...components,
    ...extractCsf3Stories(resolver.checker, absoluteFilePath, sourceFile),
  ];
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
