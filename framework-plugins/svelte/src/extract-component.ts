import { decodeComponentId, generateComponentId } from "@previewjs/api";
import type { Component } from "@previewjs/core";
import { extractCsf3Stories } from "@previewjs/storybook-helpers";
import { TypeResolver, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import path from "path";
import { analyzeSvelteComponentFromSFC } from "./analyze-component.js";
import { inferComponentNameFromSveltePath } from "./infer-component-name.js";

export async function extractSvelteComponents(
  reader: Reader,
  resolver: TypeResolver,
  rootDir: string,
  absoluteFilePath: string
): Promise<Component[]> {
  if (absoluteFilePath.endsWith(".svelte")) {
    const entry = await reader.read(absoluteFilePath);
    if (entry?.kind !== "file") {
      return [];
    }
    return [
      {
        componentId: generateComponentId({
          filePath: path.relative(rootDir, absoluteFilePath),
          name: inferComponentNameFromSveltePath(absoluteFilePath),
        }),
        offsets: [0, (await entry.read()).length],
        kind: "component",
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
    return extractCsf3Stories(
      rootDir,
      resolver,
      sourceFile,
      async (componentId) => {
        const { filePath } = decodeComponentId(componentId);
        const component = (
          await extractSvelteComponents(
            reader,
            resolver,
            rootDir,
            path.join(rootDir, filePath)
          )
        ).find((c) => c.componentId === componentId);
        if (component?.kind !== "component") {
          return {
            props: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.extractProps();
      }
    ).map((c) => {
      if (
        c.kind !== "story" ||
        !c.associatedComponent?.componentId.includes(".svelte.ts:")
      ) {
        return c;
      }
      const { filePath: associatedComponentFilePath } = decodeComponentId(
        c.associatedComponent.componentId
      );
      const associatedComponentSvelteFilePath = stripTsExtension(
        associatedComponentFilePath
      );
      return {
        ...c,
        associatedComponent: {
          ...c.associatedComponent,
          componentId: generateComponentId({
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
