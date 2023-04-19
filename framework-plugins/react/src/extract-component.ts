import { decodeComponentId, generateComponentId } from "@previewjs/api";
import type { AnalyzableComponent, ComponentTypeInfo } from "@previewjs/core";
import { parseSerializableValue } from "@previewjs/serializable-values";
import {
  extractArgs,
  extractCsf3Stories,
  extractDefaultComponent,
  resolveComponentId,
} from "@previewjs/storybook-helpers";
import { TypeResolver, UNKNOWN_TYPE, helpers } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";
import { analyzeReactComponent } from "./analyze-component.js";

export function extractReactComponents(
  resolver: TypeResolver,
  rootDirPath: string,
  absoluteFilePath: string
): AnalyzableComponent[] {
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
        functions.push([name || "default", statement, statement]);
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      functions.push([statement.name.text, statement, statement]);
    }
  }

  const storiesDefaultComponent = extractDefaultComponent(sourceFile);
  const components: AnalyzableComponent[] = [];
  const args = extractArgs(sourceFile);
  const nameToExportedName = helpers.extractExportedNames(sourceFile);

  function extractComponentTypeInfo(
    node: ts.Node,
    name: string
  ): ComponentTypeInfo | null {
    if (name === "default" && storiesDefaultComponent) {
      return null;
    }
    const storyArgs = args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    const signature = extractComponentSignature(resolver.checker, node);
    if (
      storiesDefaultComponent &&
      isExported &&
      (storyArgs || signature?.parameters.length === 0)
    ) {
      const associatedComponent = extractStoryAssociatedComponent(
        rootDirPath,
        resolver,
        storiesDefaultComponent
      );
      if (!associatedComponent) {
        // No detected associated component, give up.
        return null;
      }
      return {
        kind: "story",
        args: storyArgs
          ? {
              start: storyArgs.getStart(),
              end: storyArgs.getEnd(),
              value: parseSerializableValue(storyArgs),
            }
          : null,
        associatedComponent,
      };
    }
    if (signature) {
      return {
        kind: "component",
        exported: isExported,
        analyze: async () =>
          analyzeReactComponent(resolver, absoluteFilePath, name, signature),
      };
    }
    return null;
  }

  for (const [name, statement, node] of functions) {
    const info = extractComponentTypeInfo(node, name);
    if (info) {
      components.push({
        componentId: generateComponentId({
          filePath: path.relative(rootDirPath, absoluteFilePath),
          name,
        }),
        offsets: [[statement.getStart(), statement.getEnd()]],
        info,
      });
    }
  }

  return [
    ...components,
    ...extractCsf3Stories(
      rootDirPath,
      resolver,
      sourceFile,
      async (componentId) => {
        const { filePath } = decodeComponentId(componentId);
        const component = extractReactComponents(
          resolver,
          rootDirPath,
          path.join(rootDirPath, filePath)
        ).find((c) => c.componentId === componentId);
        if (component?.info.kind !== "component") {
          return {
            propsType: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.info.analyze();
      }
    ),
  ];
}

function extractStoryAssociatedComponent(
  rootDirPath: string,
  resolver: TypeResolver,
  component: ts.Expression
) {
  const resolvedStoriesComponentId = resolveComponentId(
    rootDirPath,
    resolver.checker,
    component
  );
  return resolvedStoriesComponentId
    ? {
        componentId: resolvedStoriesComponentId,
        analyze: async () => {
          const signature = extractComponentSignature(
            resolver.checker,
            component
          );
          if (!signature) {
            return {
              propsType: UNKNOWN_TYPE,
              types: {},
            };
          }
          const { filePath, name } = decodeComponentId(
            resolvedStoriesComponentId
          );
          return analyzeReactComponent(
            resolver,
            path.join(rootDirPath, filePath),
            name,
            signature
          );
        },
      }
    : null;
}

function extractComponentSignature(
  checker: ts.TypeChecker,
  node: ts.Node
): ts.Signature | null {
  let type = checker.getTypeAtLocation(node);

  // When we encounter a story defined as ... = Template.bind({}) where the
  // type cannot be detected, fall back to the type of Template.
  if (
    type.flags === ts.TypeFlags.Any &&
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.name) &&
    node.expression.name.text === "bind"
  ) {
    const symbol = checker.getSymbolAtLocation(node.expression.expression);
    if (
      symbol?.valueDeclaration &&
      ts.isVariableDeclaration(symbol.valueDeclaration) &&
      symbol.valueDeclaration.initializer
    ) {
      type = checker.getTypeAtLocation(symbol.valueDeclaration.initializer);
    }
  }

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
