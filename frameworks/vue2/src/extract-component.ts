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
import type { Reader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";
import { analyzeVueComponentFromTemplate } from "./analyze-component.js";
import { inferComponentNameFromVuePath } from "./infer-component-name.js";

export function extractVueComponents(
  reader: Reader,
  resolver: TypeResolver,
  rootDirPath: string,
  absoluteFilePath: string
): AnalyzableComponent[] {
  const vueAbsoluteFilePath = extractVueFilePath(absoluteFilePath);
  if (vueAbsoluteFilePath) {
    const virtualVueTsAbsoluteFilePath = vueAbsoluteFilePath + ".ts";
    const fileEntry = reader.readSync(vueAbsoluteFilePath);
    if (fileEntry?.kind !== "file") {
      return [];
    }
    return [
      {
        componentId: generateComponentId({
          filePath: path.relative(rootDirPath, absoluteFilePath),
          name: inferComponentNameFromVuePath(vueAbsoluteFilePath),
        }),
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
  const components: AnalyzableComponent[] = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = extractArgs(sourceFile);

  function extractComponentTypeInfo(
    node: ts.Node,
    name: string
  ): ComponentTypeInfo | null {
    const storyArgs = args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    if (storiesDefaultComponent && storyArgs && isExported) {
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
        const absoluteFilePath = path.join(rootDirPath, filePath);
        const vueComponents = extractVueComponents(
          reader,
          resolver,
          rootDirPath,
          absoluteFilePath
        );
        const component = absoluteFilePath.endsWith(".vue.ts")
          ? vueComponents[0]
          : vueComponents.find((c) => c.componentId === componentId);
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
        !c.info.associatedComponent.componentId.includes(".vue.ts:")
      ) {
        return c;
      }
      const { filePath: associatedComponentFilePath } = decodeComponentId(
        c.info.associatedComponent.componentId
      );
      const associatedComponentVueFilePath = stripTsExtension(
        associatedComponentFilePath
      );
      return {
        ...c,
        info: {
          ...c.info,
          associatedComponent: {
            ...c.info.associatedComponent,
            componentId: generateComponentId({
              filePath: associatedComponentVueFilePath,
              name: inferComponentNameFromVuePath(
                associatedComponentVueFilePath
              ),
            }),
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
  rootDirPath: string,
  resolver: TypeResolver,
  component: ts.Expression
) {
  const resolvedStoriesComponentId = resolveComponentId(
    rootDirPath,
    resolver.checker,
    component
  );
  if (!resolvedStoriesComponentId) {
    return null;
  }
  const { filePath } = decodeComponentId(resolvedStoriesComponentId);
  const vueFilePath = extractVueFilePath(filePath);
  if (vueFilePath) {
    return {
      componentId: generateComponentId({
        filePath: vueFilePath,
        name: inferComponentNameFromVuePath(vueFilePath),
      }),
      analyze: async () =>
        analyzeVueComponentFromTemplate(resolver, vueFilePath + ".ts"),
    };
  } else {
    return {
      componentId: resolvedStoriesComponentId,
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
