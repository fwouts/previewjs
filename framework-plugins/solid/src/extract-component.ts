import { decodeComponentId, generateComponentId } from "@previewjs/api";
import type {
  BaseComponent,
  BasicFrameworkComponent,
  Component,
} from "@previewjs/component-detection-api";
import { parseSerializableValue } from "@previewjs/serializable-values";
import {
  extractArgs,
  extractCsf3Stories,
  extractStoriesInfo,
  resolveComponentId,
} from "@previewjs/storybook-helpers";
import type { TypeResolver } from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE, helpers } from "@previewjs/type-analyzer";
import path from "path";
import type { Logger } from "pino";
import ts from "typescript";
import { analyzeSolidComponent } from "./analyze-component.js";

export function extractSolidComponents(
  logger: Logger,
  resolver: TypeResolver,
  rootDirPath: string,
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

  const storiesInfo = extractStoriesInfo(sourceFile);
  const components: Component[] = [];
  const args = extractArgs(sourceFile);
  const nameToExportedName = helpers.extractExportedNames(sourceFile);

  function extractComponent(
    baseComponent: BaseComponent,
    node: ts.Node,
    name: string
  ): Component | null {
    if (name === "default" && storiesInfo) {
      return null;
    }
    const storyArgs = args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    const signature = extractComponentSignature(resolver.checker, node);
    if (
      storiesInfo &&
      isExported &&
      (storyArgs || signature?.parameters.length === 0)
    ) {
      const associatedComponent = extractStoryAssociatedComponent(
        logger,
        resolver,
        rootDirPath,
        storiesInfo.component
      );
      return {
        ...baseComponent,
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
        ...baseComponent,
        kind: "component",
        exported: isExported,
        extractProps: async () =>
          analyzeSolidComponent(logger, resolver, signature),
      };
    }
    return null;
  }

  for (const [name, statement, node] of functions) {
    const component = extractComponent(
      {
        componentId: generateComponentId({
          filePath: path.relative(rootDirPath, absoluteFilePath),
          name,
        }),
        offsets: [statement.getStart(), statement.getEnd()],
      },
      node,
      name
    );
    if (component) {
      components.push(component);
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
        const component = extractSolidComponents(
          logger,
          resolver,
          rootDirPath,
          path.join(rootDirPath, filePath)
        ).find((c) => c.componentId === componentId);
        if (component?.kind !== "component") {
          return {
            props: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.extractProps();
      }
    ),
  ];
}

function extractStoryAssociatedComponent(
  logger: Logger,
  resolver: TypeResolver,
  rootDirPath: string,
  component: ts.Expression | null
): BasicFrameworkComponent | null {
  const resolvedStoriesComponentId = resolveComponentId(
    rootDirPath,
    resolver.checker,
    component
  );
  return component && resolvedStoriesComponentId
    ? {
        componentId: resolvedStoriesComponentId,
        extractProps: async () => {
          const signature = extractComponentSignature(
            resolver.checker,
            component
          );
          if (!signature) {
            return {
              props: UNKNOWN_TYPE,
              types: {},
            };
          }
          return analyzeSolidComponent(logger, resolver, signature);
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
