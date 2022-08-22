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
  const components: Component[] = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = helpers.extractArgs(sourceFile);
  // TODO: Handle JSX and Storybook stories.
  const analysis: ComponentAnalysis = {
    propsType: UNKNOWN_TYPE,
    types: {},
  };

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
          resolver.checker,
          declaration.initializer,
          !!args[name]
        );
        if (signature) {
          components.push({
            absoluteFilePath,
            name,
            isStory: !!args[name],
            exported: !!exportedName,
            offsets: [[statement.getFullStart(), statement.getEnd()]],
            analyze: async () => analysis,
          });
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const exportedName = nameToExportedName[name];
      if (!isValidVueComponentName(name)) {
        continue;
      }
      const signature = extractVueComponent(
        resolver.checker,
        statement,
        !!args[name]
      );
      if (signature) {
        components.push({
          absoluteFilePath,
          name,
          isStory: !!args[name],
          exported: !!exportedName,
          offsets: [[statement.getFullStart(), statement.getEnd()]],
          analyze: async () => analysis,
        });
      }
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
