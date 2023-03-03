import type { Component, ComponentTypeInfo } from "@previewjs/core";
import {
  extractCsf3Stories,
  extractDefaultComponent,
  resolveComponent,
} from "@previewjs/csf3";
import { parseSerializableValue } from "@previewjs/serializable-values";
import { helpers, TypeResolver, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import ts from "typescript";
import { analyzeVueComponentFromTemplate } from "./analyze-component";
import { inferComponentNameFromVuePath } from "./infer-component-name";

export function extractVueComponents(
  reader: Reader,
  resolver: TypeResolver,
  absoluteFilePath: string
): Component[] {
  const vueAbsoluteFilePath = extractVueFilePath(absoluteFilePath);
  if (vueAbsoluteFilePath) {
    const virtualVueTsAbsoluteFilePath = vueAbsoluteFilePath + ".ts";
    const fileEntry = reader.readSync(vueAbsoluteFilePath);
    if (fileEntry?.kind !== "file") {
      return [];
    }
    return [
      {
        absoluteFilePath: vueAbsoluteFilePath,
        name: inferComponentNameFromVuePath(vueAbsoluteFilePath),
        offsets: [[0, fileEntry.size()]],
        info: {
          kind: "component",
          exported: true,
          analyze: async () =>
            analyzeVueComponentFromTemplate(
              resolver,
              virtualVueTsAbsoluteFilePath
            ),
        },
      },
    ];
  }

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
    }
  }

  const storiesDefaultComponent = extractDefaultComponent(sourceFile);
  const components: Component[] = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = helpers.extractArgs(sourceFile);

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
    const type = resolver.checker.getTypeAtLocation(node);
    for (const callSignature of type.getCallSignatures()) {
      const returnType = callSignature.getReturnType();
      if (isJsxElement(returnType)) {
        return {
          kind: "component",
          exported: isExported,
          analyze: async () => ({
            // TODO: Handle JSX properties.
            propsType: UNKNOWN_TYPE,
            types: {},
          }),
        };
      }
      if (
        storiesDefaultComponent &&
        isExported &&
        returnType.getProperty("template")
      ) {
        // This is a story.
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
          args: null,
          associatedComponent,
        };
      }
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
        const vueComponents = extractVueComponents(
          reader,
          resolver,
          absoluteFilePath
        );
        const component = absoluteFilePath.endsWith(".vue.ts")
          ? vueComponents[0]
          : vueComponents.find((c) => c.name === name);
        if (component?.info.kind !== "component") {
          return {
            propsType: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.info.analyze();
      }
    ).map((c) => {
      if (
        c.info.kind !== "story" ||
        !c.info.associatedComponent.absoluteFilePath.endsWith(".vue.ts")
      ) {
        return c;
      }
      const associatedComponentVueAbsoluteFilePath = stripTsExtension(
        c.info.associatedComponent.absoluteFilePath
      );
      return {
        ...c,
        info: {
          ...c.info,
          associatedComponent: {
            ...c.info.associatedComponent,
            absoluteFilePath: associatedComponentVueAbsoluteFilePath,
            name: inferComponentNameFromVuePath(
              associatedComponentVueAbsoluteFilePath
            ),
          },
        },
      };
    }),
  ];
}

function stripTsExtension(filePath: string) {
  return filePath.substring(0, filePath.length - 3);
}

function extractVueFilePath(filePath: string) {
  if (filePath.endsWith(".vue")) {
    return filePath;
  }
  if (filePath.endsWith(".vue.ts")) {
    return filePath.substring(0, filePath.length - 3);
  }
  return null;
}

function extractStoryAssociatedComponent(
  resolver: TypeResolver,
  component: ts.Expression
) {
  const resolvedStoriesComponent = resolveComponent(
    resolver.checker,
    component
  );
  if (!resolvedStoriesComponent) {
    return null;
  }
  const vueAbsoluteFilePath = extractVueFilePath(
    resolvedStoriesComponent.absoluteFilePath
  );
  if (vueAbsoluteFilePath) {
    return {
      absoluteFilePath: vueAbsoluteFilePath,
      name: inferComponentNameFromVuePath(vueAbsoluteFilePath),
      analyze: async () =>
        analyzeVueComponentFromTemplate(resolver, vueAbsoluteFilePath + ".ts"),
    };
  } else {
    return {
      ...resolvedStoriesComponent,
      analyze: async () =>
        // TODO: Handle JSX properties.
        ({
          propsType: UNKNOWN_TYPE,
          types: {},
        }),
    };
  }
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
