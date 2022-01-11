import { DetectedComponent, extractArgs } from "@previewjs/core";
import { detectExportedNames } from "@previewjs/core/ts-helpers";
import ts from "typescript";

export function extractVueComponents(
  program: ts.Program,
  filePath: string,
  options: {
    offset?: number;
  } = {}
): DetectedComponent[] {
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    return [];
  }
  let components: DetectedComponent[] = [];
  const nameToExportedName = detectExportedNames(sourceFile);
  const args = extractArgs(sourceFile);

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
        const name = declaration.name.text;
        const exportedName = nameToExportedName[name];
        if (!isValidVueComponentName(name)) {
          continue;
        }
        const signature = extractVueComponent(
          checker,
          declaration.initializer,
          !!args[name]
        );
        if (signature) {
          components.push({
            filePath,
            name,
            exported: !!exportedName,
            offsets: [[statement.getFullStart(), statement.getEnd()]],
          });
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const exportedName = nameToExportedName[name];
      if (!isValidVueComponentName(name)) {
        continue;
      }
      const signature = extractVueComponent(checker, statement, !!args[name]);
      if (signature) {
        components.push({
          filePath,
          name,
          exported: !!exportedName,
          offsets: [[statement.getFullStart(), statement.getEnd()]],
        });
      }
    }
  }

  return components;
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
    if (returnType.getProperty("template") && hasArgs) {
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

function isValidVueComponentName(name: string) {
  return name.length > 0 && name[0]! >= "A" && name[0]! <= "Z";
}
