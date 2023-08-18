import type { Component, Story } from "@previewjs/analyzer-api";
import {
  decodePreviewableId,
  generatePreviewableId,
} from "@previewjs/analyzer-api";
import { extractCsf3Stories } from "@previewjs/storybook-helpers";
import type { TypeResolver } from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import path from "path";
import { computePropsFromSFC } from "./compute-props.js";
import { inferComponentNameFromSveltePath } from "./infer-component-name.js";

export async function analyze(
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
        id: generatePreviewableId({
          filePath: path.relative(rootDir, absoluteFilePath),
          name: inferComponentNameFromSveltePath(absoluteFilePath),
        }),
        sourcePosition: {
          start: 0,
          end: (await entry.read()).length,
        },
        exported: true,
        extractProps: async () =>
          computePropsFromSFC(resolver, absoluteFilePath + ".ts"),
      },
    ];
  } else {
    const sourceFile = resolver.sourceFile(absoluteFilePath);
    if (!sourceFile) {
      return [];
    }
    return (
      await extractCsf3Stories(rootDir, resolver, sourceFile, async (id) => {
        const { filePath } = decodePreviewableId(id);
        const component = (
          await analyze(reader, resolver, rootDir, path.join(rootDir, filePath))
        ).find((c) => c.id === id);
        if (!component || !("extractProps" in component)) {
          return {
            props: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.extractProps();
      })
    ).map((story) => {
      if (!story.associatedComponent?.id.includes(".svelte.ts:")) {
        return story;
      }
      const { filePath: associatedComponentFilePath } = decodePreviewableId(
        story.associatedComponent.id
      );
      const associatedComponentSvelteFilePath = stripTsExtension(
        associatedComponentFilePath
      );
      return {
        ...story,
        associatedComponent: {
          ...story.associatedComponent,
          id: generatePreviewableId({
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
