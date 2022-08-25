import type { Component } from "@previewjs/core";
import { extractCsf3Stories } from "@previewjs/csf3";
import { helpers, TypeResolver } from "@previewjs/type-analyzer";
import ts from "typescript";
import { analyzeSolidComponent } from "./analyze-component";

export function extractSolidComponents(
  resolver: TypeResolver,
  absoluteFilePath: string
): Component[] {
  const sourceFile = resolver.sourceFile(absoluteFilePath);
  if (!sourceFile) {
    return [];
  }

  const functions: Array<[string, ts.Statement, ts.Node]> = [];
  for (const statement of sourceFile.statements) {
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
        functions.push([
          isDefaultExport || !name ? "default" : name,
          statement,
          statement,
        ]);
      }
    }
  }

  const components: Component[] = [];
  const args = helpers.extractArgs(sourceFile);
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  for (const [name, statement, node] of functions) {
    const hasArgs = !!args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    const signature = extractSolidComponent(resolver.checker, node);
    if (signature) {
      components.push({
        absoluteFilePath,
        name,
        isStory: hasArgs,
        exported: isExported,
        offsets: [[statement.getStart(), statement.getEnd()]],
        analyze: async () => analyzeSolidComponent(resolver, signature),
      });
    }
  }
  return [...components, ...extractCsf3Stories(absoluteFilePath, sourceFile)];
}

function extractSolidComponent(
  checker: ts.TypeChecker,
  node: ts.Node
): ts.Signature | null {
  const type = checker.getTypeAtLocation(node);
  for (const callSignature of type.getCallSignatures()) {
    if (isValidComponentReturnType(callSignature.getReturnType())) {
      return callSignature;
    }
  }
  return null;
}

function isValidComponentReturnType(type: ts.Type): boolean {
  if (isJsxElement(type)) {
    return true;
  }
  return false;
}

const jsxElementTypes = new Set(["Element", "FunctionElement"]);
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
