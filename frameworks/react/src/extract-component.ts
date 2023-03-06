import type { Component, ComponentTypeInfo } from "@previewjs/core";
import {
  extractCsf3Stories,
  extractDefaultComponent,
  resolveComponent,
} from "@previewjs/csf3";
import { parseSerializableValue } from "@previewjs/serializable-values";
import { helpers, TypeResolver, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import ts from "typescript";
import { analyzeReactComponent } from "./analyze-component.js";

export function extractReactComponents(
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
        functions.push([name || "default", statement, statement]);
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      functions.push([statement.name.text, statement, statement]);
    }
  }

  const storiesDefaultComponent = extractDefaultComponent(sourceFile);
  const components: Component[] = [];
  const args = helpers.extractArgs(sourceFile);
  const nameToExportedName = helpers.extractExportedNames(sourceFile);

  function extractComponentTypeInfo(
    node: ts.Node,
    name: string
  ): ComponentTypeInfo | null {
    const storyArgs = args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    if (storiesDefaultComponent && storyArgs && isExported) {
      const associatedComponent = extractStoryAssociatedComponent(
        resolver,
        storiesDefaultComponent
      );
      if (!associatedComponent) {
        // No detected associated component, give up.
        return null;
      }
      return {
        kind: "story",
        args: {
          start: storyArgs.getStart(),
          end: storyArgs.getEnd(),
          value: parseSerializableValue(storyArgs),
        },
        associatedComponent,
      };
    }
    const signature = extractComponentSignature(resolver.checker, node);
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
        absoluteFilePath,
        name,
        offsets: [[statement.getStart(), statement.getEnd()]],
        info,
      });
    }
  }

  return [
    ...components,
    ...extractCsf3Stories(
      resolver,
      sourceFile,
      async ({ absoluteFilePath, name }) => {
        const component = extractReactComponents(
          resolver,
          absoluteFilePath
        ).find((c) => c.name === name);
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
  resolver: TypeResolver,
  component: ts.Expression
) {
  const resolvedStoriesComponent = resolveComponent(
    resolver.checker,
    component
  );
  return resolvedStoriesComponent
    ? {
        ...resolvedStoriesComponent,
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
          return analyzeReactComponent(
            resolver,
            resolvedStoriesComponent.absoluteFilePath,
            resolvedStoriesComponent.name,
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
