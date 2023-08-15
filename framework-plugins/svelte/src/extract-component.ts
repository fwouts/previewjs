import type { Component, Story } from "@previewjs/component-analyzer-api";
import {
  decodePreviewableId,
  generatePreviewableId,
} from "@previewjs/component-analyzer-api";
import { extractCsf3Stories } from "@previewjs/storybook-helpers";
import type { TypeResolver } from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import path from "path";
import { analyzeSvelteComponentFromSFC } from "./analyze-component.js";
import { inferComponentNameFromSveltePath } from "./infer-component-name.js";

export async function extractSvelteComponents(
  reader: Reader,
  resolver: TypeResolver,
  rootDir: string,
  absoluteFilePath: string
): Promise<Array<Component | Story>> {
  if (absoluteFilePath.endsWith(".svelte")) {
    const entry = await reader.read(absoluteFilePath);
    if (entry?.kind !== "file") {
      return [];
    }
    return [
      {
        previewableId: generatePreviewableId({
          filePath: path.relative(rootDir, absoluteFilePath),
          name: inferComponentNameFromSveltePath(absoluteFilePath),
        }),
        sourcePosition: {
          start: 0,
          end: (await entry.read()).length,
        },
        exported: true,
        extractProps: async () =>
          analyzeSvelteComponentFromSFC(resolver, absoluteFilePath + ".ts"),
      },
    ];
  } else {
    const sourceFile = resolver.sourceFile(absoluteFilePath);
    if (!sourceFile) {
      return [];
    }
    return (
      await extractCsf3Stories(
        rootDir,
        resolver,
        sourceFile,
        async (previewableId) => {
          const { filePath } = decodePreviewableId(previewableId);
          const component = (
            await extractSvelteComponents(
              reader,
              resolver,
              rootDir,
              path.join(rootDir, filePath)
            )
          ).find((c) => c.previewableId === previewableId);
          if (!component || !("extractProps" in component)) {
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
        !("associatedComponent" in c) ||
        !c.associatedComponent?.previewableId.includes(".svelte.ts:")
      ) {
        return c;
      }
      const { filePath: associatedComponentFilePath } = decodePreviewableId(
        c.associatedComponent.previewableId
      );
      const associatedComponentSvelteFilePath = stripTsExtension(
        associatedComponentFilePath
      );
      return {
        ...c,
        associatedComponent: {
          ...c.associatedComponent,
          previewableId: generatePreviewableId({
            filePath: associatedComponentSvelteFilePath,
            name: inferComponentNameFromSveltePath(
              associatedComponentSvelteFilePath
            ),
          }),
        },
      };
    });
  }
}

function stripTsExtension(filePath: string) {
  return filePath.substring(0, filePath.length - 3);
}
