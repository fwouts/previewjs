import type {
  BaseComponent,
  BasicFrameworkComponent,
  Component,
} from "@previewjs/component-analyzer-api";
import {
  decodeComponentId,
  generateComponentId,
} from "@previewjs/component-analyzer-api";
import { parseSerializableValue } from "@previewjs/serializable-values";
import {
  extractArgs,
  extractCsf3Stories,
  extractStoriesInfo,
  resolveComponentId,
} from "@previewjs/storybook-helpers";
import type { TypeResolver } from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE, helpers } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";
import { analyzeVueComponentFromTemplate } from "./analyze-component.js";
import { inferComponentNameFromVuePath } from "./infer-component-name.js";

export async function extractVueComponents(
  reader: Reader,
  resolver: TypeResolver,
  rootDir: string,
  absoluteFilePath: string
): Promise<Component[]> {
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
          filePath: path.relative(rootDir, vueAbsoluteFilePath),
          name: inferComponentNameFromVuePath(vueAbsoluteFilePath),
        }),
        offsets: [0, fileEntry.size()],
        kind: "component",
        exported: true,
        extractProps: async () =>
          analyzeVueComponentFromTemplate(
            resolver,
            virtualVueTsAbsoluteFilePath
          ),
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

  const storiesInfo = extractStoriesInfo(sourceFile);
  const components: Component[] = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = extractArgs(sourceFile);

  async function extractComponent(
    baseComponent: BaseComponent,
    node: ts.Node,
    name: string
  ): Promise<Component | null> {
    const storyArgs = args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    if (storiesInfo && storyArgs && isExported) {
      const associatedComponent = extractStoryAssociatedComponent(
        rootDir,
        resolver,
        storiesInfo.component
      );
      return {
        ...baseComponent,
        kind: "story",
        args: {
          start: storyArgs.getStart(),
          end: storyArgs.getEnd(),
          value: await parseSerializableValue(storyArgs),
        },
        associatedComponent,
      };
    }
    const type = resolver.checker.getTypeAtLocation(node);
    for (const callSignature of type.getCallSignatures()) {
      const returnType = callSignature.getReturnType();
      if (isJsxElement(returnType)) {
        return {
          ...baseComponent,
          kind: "component",
          exported: isExported,
          extractProps: async () => ({
            // TODO: Handle JSX properties.
            props: UNKNOWN_TYPE,
            types: {},
          }),
        };
      }
      if (storiesInfo && isExported && returnType.getProperty("template")) {
        // This is a story.
        const associatedComponent = extractStoryAssociatedComponent(
          rootDir,
          resolver,
          storiesInfo.component
        );
        return {
          ...baseComponent,
          kind: "story",
          args: null,
          associatedComponent,
        };
      }
    }
    return null;
  }

  for (const [name, statement, node] of functions) {
    const component = await extractComponent(
      {
        componentId: generateComponentId({
          filePath: path.relative(rootDir, absoluteFilePath),
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
    ...(
      await extractCsf3Stories(
        rootDir,
        resolver,
        sourceFile,
        async (componentId) => {
          const { filePath } = decodeComponentId(componentId);
          const absoluteFilePath = path.join(rootDir, filePath);
          const vueComponents = await extractVueComponents(
            reader,
            resolver,
            rootDir,
            absoluteFilePath
          );
          const component = absoluteFilePath.endsWith(".vue.ts")
            ? vueComponents[0]
            : vueComponents.find((c) => c.componentId === componentId);
          if (component?.kind !== "component") {
            return {
              props: UNKNOWN_TYPE,
              types: {},
            };
          }
          return component.extractProps();
        }
      )
    ).map((c) => {
      if (
        c.kind !== "story" ||
        !c.associatedComponent?.componentId.includes(".vue.ts:")
      ) {
        return c;
      }
      const { filePath: associatedComponentFilePath } = decodeComponentId(
        c.associatedComponent.componentId
      );
      const associatedComponentVueFilePath = stripTsExtension(
        associatedComponentFilePath
      );
      return {
        ...c,
        associatedComponent: {
          ...c.associatedComponent,
          componentId: generateComponentId({
            filePath: associatedComponentVueFilePath,
            name: inferComponentNameFromVuePath(associatedComponentVueFilePath),
          }),
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
  rootDir: string,
  resolver: TypeResolver,
  component: ts.Expression | null
): BasicFrameworkComponent | null {
  const resolvedStoriesComponentId = resolveComponentId(
    rootDir,
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
      extractProps: async () =>
        analyzeVueComponentFromTemplate(resolver, vueFilePath + ".ts"),
    };
  } else {
    return {
      componentId: resolvedStoriesComponentId,
      extractProps: async () =>
        // TODO: Handle JSX properties.
        ({
          props: UNKNOWN_TYPE,
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
