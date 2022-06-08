import { Component } from "@previewjs/core";
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
  let components: Array<
    Omit<Component, "analyze"> & {
      signature: ts.Signature;
    }
  > = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      if (ts.isIdentifier(statement.expression)) {
        // Avoid duplicates.
        continue;
      }
      const signature = extractSolidComponent(
        resolver.checker,
        statement.expression
      );
      if (signature) {
        components.push({
          absoluteFilePath,
          name: "default",
          exported: true,
          offsets: [[statement.getStart(), statement.getEnd()]],
          signature,
        });
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        const name = declaration.name.text;
        const exportedName = nameToExportedName[name];
        if (!isValidSolidComponentName(name)) {
          continue;
        }
        const signature = extractSolidComponent(
          resolver.checker,
          declaration.initializer
        );
        if (signature) {
          components.push({
            absoluteFilePath,
            name,
            exported: !!exportedName,
            offsets: [[statement.getStart(), statement.getEnd()]],
            signature,
          });
        }
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
      const exported = (name && !!nameToExportedName[name]) || isDefaultExport;
      if (isDefaultExport || (name && isValidSolidComponentName(name))) {
        const signature = extractSolidComponent(resolver.checker, statement);
        if (signature) {
          components.push({
            absoluteFilePath,
            name: isDefaultExport || !name ? "default" : name,
            exported,
            offsets: [[statement.getStart(), statement.getEnd()]],
            signature,
          });
        }
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const exportedName = nameToExportedName[name];
      if (!isValidSolidComponentName(name)) {
        continue;
      }
      const signature = extractSolidComponent(resolver.checker, statement);
      if (signature) {
        components.push({
          absoluteFilePath,
          name,
          exported: !!exportedName,
          offsets: [[statement.getStart(), statement.getEnd()]],
          signature,
        });
      }
    }
  }

  return components.map(({ signature, ...component }) => ({
    ...component,
    analyze: async () =>
      analyzeSolidComponent(
        resolver,
        component.absoluteFilePath,
        component.name,
        signature
      ),
  }));
}

function extractSolidComponent(
  checker: ts.TypeChecker,
  node: ts.Node
): ts.Signature | null {
  const type = checker.getTypeAtLocation(node);

  // Function component.
  for (const callSignature of type.getCallSignatures()) {
    if (isValidComponentReturnType(callSignature.getReturnType())) {
      return callSignature;
    }
  }
  // Class component.
  if (type.symbol) {
    const classType = checker.getTypeOfSymbolAtLocation(type.symbol, node);
    for (const constructSignature of classType.getConstructSignatures()) {
      const returnType = constructSignature.getReturnType();
      if (returnType.getProperty("render")) {
        return constructSignature;
      }
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

function isValidSolidComponentName(name: string) {
  return name.length > 0 && name[0]! >= "A" && name[0]! <= "Z";
}
