import type {
  BasePreviewable,
  BasicComponent,
  Component,
  Story,
} from "@previewjs/analyzer-api";
import {
  decodePreviewableId,
  generatePreviewableId,
} from "@previewjs/analyzer-api";
import { parseSerializableValue } from "@previewjs/serializable-values";
import {
  extractArgs,
  extractCsf3Stories,
  extractStoriesInfo,
  resolvePreviewableId,
} from "@previewjs/storybook-helpers";
import type { TypeResolver } from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE, helpers } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";
import { analyzeFromTemplate } from "./analyze.js";
import { inferComponentNameFromVuePath } from "./infer-component-name.js";

export async function crawlFile(
  reader: Reader,
  resolver: TypeResolver,
  rootDir: string,
  absoluteFilePath: string
): Promise<Array<Component | Story>> {
  const vueAbsoluteFilePath = extractVueFilePath(absoluteFilePath);
  if (vueAbsoluteFilePath) {
    const virtualVueTsAbsoluteFilePath = vueAbsoluteFilePath + ".ts";
    const fileEntry = reader.readSync(vueAbsoluteFilePath);
    if (fileEntry?.kind !== "file") {
      return [];
    }
    return [
      {
        id: generatePreviewableId({
          filePath: path.relative(rootDir, vueAbsoluteFilePath),
          name: inferComponentNameFromVuePath(vueAbsoluteFilePath),
        }),
        sourcePosition: {
          start: 0,
          end: fileEntry.size(),
        },
        exported: true,
        analyze: async () =>
          analyzeFromTemplate(resolver, virtualVueTsAbsoluteFilePath),
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
  const previewables: Array<Component | Story> = [];
  const nameToExportedName = helpers.extractExportedNames(sourceFile);
  const args = extractArgs(sourceFile);

  async function extractPreviewable(
    basePreviewable: BasePreviewable,
    node: ts.Node,
    name: string
  ): Promise<Component | Story | null> {
    const storyArgs = args[name];
    const isExported = name === "default" || !!nameToExportedName[name];
    if (storiesInfo && storyArgs && isExported) {
      const associatedComponent = extractStoryAssociatedComponent(
        rootDir,
        resolver,
        storiesInfo.component
      );
      return {
        ...basePreviewable,
        analyze: async () => ({
          args: {
            sourcePosition: {
              start: storyArgs.getStart(),
              end: storyArgs.getEnd(),
            },
            value: await parseSerializableValue(storyArgs),
          },
        }),
        associatedComponent,
      };
    }
    const type = resolver.checker.getTypeAtLocation(node);
    for (const callSignature of type.getCallSignatures()) {
      const returnType = callSignature.getReturnType();
      if (isJsxElement(returnType)) {
        return {
          ...basePreviewable,
          exported: isExported,
          analyze: async () => ({
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
          ...basePreviewable,
          analyze: async () => ({ args: null }),
          associatedComponent,
        };
      }
    }
    return null;
  }

  for (const [name, statement, node] of functions) {
    const previewable = await extractPreviewable(
      {
        id: generatePreviewableId({
          filePath: path.relative(rootDir, absoluteFilePath),
          name,
        }),
        sourcePosition: {
          start: statement.getStart(),
          end: statement.getEnd(),
        },
      },
      node,
      name
    );
    if (previewable) {
      previewables.push(previewable);
    }
  }

  return [
    ...previewables,
    ...(
      await extractCsf3Stories(rootDir, resolver, sourceFile, async (id) => {
        const { filePath } = decodePreviewableId(id);
        const absoluteFilePath = path.join(rootDir, filePath);
        const vueComponents = await crawlFile(
          reader,
          resolver,
          rootDir,
          absoluteFilePath
        );
        const component = absoluteFilePath.endsWith(".vue.ts")
          ? vueComponents[0]
          : vueComponents.find((c) => c.id === id);
        if (!component || !("exported" in component)) {
          return {
            props: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.analyze();
      })
    ).map((story) => {
      if (!story.associatedComponent?.id.includes(".vue.ts:")) {
        return story;
      }
      const { filePath: associatedComponentFilePath } = decodePreviewableId(
        story.associatedComponent.id
      );
      const associatedComponentVueFilePath = stripTsExtension(
        associatedComponentFilePath
      );
      return {
        ...story,
        associatedComponent: {
          ...story.associatedComponent,
          id: generatePreviewableId({
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
): BasicComponent | null {
  const resolvedStoriesPreviewableId = resolvePreviewableId(
    rootDir,
    resolver.checker,
    component
  );
  if (!resolvedStoriesPreviewableId) {
    return null;
  }
  const { filePath } = decodePreviewableId(resolvedStoriesPreviewableId);
  const vueFilePath = extractVueFilePath(filePath);
  if (vueFilePath) {
    return {
      id: generatePreviewableId({
        filePath: vueFilePath,
        name: inferComponentNameFromVuePath(vueFilePath),
      }),
      analyze: async () => analyzeFromTemplate(resolver, vueFilePath + ".ts"),
    };
  } else {
    return {
      id: resolvedStoriesPreviewableId,
      analyze: async () =>
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
