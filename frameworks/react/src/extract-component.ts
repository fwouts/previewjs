import { DetectedComponent } from "@previewjs/core";
import { detectExportedNames } from "@previewjs/core/ts-helpers";
import ts from "typescript";

export interface ReactComponent extends DetectedComponent {
  signature: ts.Signature;
}

export function extractReactComponents(
  program: ts.Program,
  filePath: string
): ReactComponent[] {
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    return [];
  }
  const checker = program.getTypeChecker();
  let components: ReactComponent[] = [];
  const nameToExportedName = detectExportedNames(sourceFile);

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      const signature = extractReactComponent(checker, statement.expression);
      if (signature) {
        components.push({
          filePath,
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
        if (!isValidReactComponentName(name)) {
          continue;
        }
        const signature = extractReactComponent(
          checker,
          declaration.initializer
        );
        if (signature) {
          components.push({
            filePath,
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
      if (isDefaultExport || (name && isValidReactComponentName(name))) {
        const signature = extractReactComponent(checker, statement);
        if (signature) {
          components.push({
            filePath,
            name: name || "default",
            exported,
            offsets: [[statement.getStart(), statement.getEnd()]],
            signature,
          });
        }
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const exportedName = nameToExportedName[name];
      if (!isValidReactComponentName(name)) {
        continue;
      }
      const signature = extractReactComponent(checker, statement);
      if (signature) {
        components.push({
          filePath,
          name,
          exported: !!exportedName,
          offsets: [[statement.getStart(), statement.getEnd()]],
          signature,
        });
      }
    }
  }

  return components;
}

function extractReactComponent(
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

const jsxElementTypes = new Set(["Element", "ReactElement"]);
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

function isValidReactComponentName(name: string) {
  return name.length > 0 && name[0]! >= "A" && name[0]! <= "Z";
}
