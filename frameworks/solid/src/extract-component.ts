import type { Component, ComponentTypeInfo } from "@previewjs/core";
import { parseSerializableValue } from "@previewjs/serializable-values";
import {
  extractArgs,
  extractCsf3Stories,
  extractDefaultComponent,
  resolveComponent,
} from "@previewjs/storybook-helpers";
import { TypeResolver, UNKNOWN_TYPE, helpers } from "@previewjs/type-analyzer";
import ts from "typescript";
import { analyzeSolidComponent } from "./analyze-component.js";

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

  const storiesDefaultComponent = extractDefaultComponent(sourceFile);
  const components: Component[] = [];
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
        analyze: async () => analyzeSolidComponent(resolver, signature),
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
        const component = extractSolidComponents(
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
          return analyzeSolidComponent(resolver, signature);
        },
      }
    : null;
}

function extractComponentSignature(
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
  return (
    jsxElementTypes.has(type.symbol?.getEscapedName().toString()) ||
    jsxElementTypes.has(type.aliasSymbol?.getEscapedName().toString() || "")
  );
}
