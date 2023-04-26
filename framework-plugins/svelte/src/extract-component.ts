import { decodeComponentId, generateComponentId } from "@previewjs/api";
import type { AnalyzableComponent } from "@previewjs/core";
import { extractCsf3Stories } from "@previewjs/storybook-helpers";
import { TypeResolver, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import { Reader } from "@previewjs/vfs";
import path from "path";
import { analyzeSvelteComponentFromSFC } from "./analyze-component.js";
import { inferComponentNameFromSveltePath } from "./infer-component-name.js";

export async function extractSvelteComponents(
  reader: Reader,
  resolver: TypeResolver,
  rootDirPath: string,
  absoluteFilePath: string
): Promise<AnalyzableComponent[]> {
  if (absoluteFilePath.endsWith(".svelte")) {
    const entry = await reader.read(absoluteFilePath);
    if (entry?.kind !== "file") {
      return [];
    }
    return [
      {
        componentId: generateComponentId({
          filePath: path.relative(rootDirPath, absoluteFilePath),
          name: inferComponentNameFromSveltePath(absoluteFilePath),
        }),
        offsets: [[0, (await entry.read()).length]],
        info: {
          kind: "component",
          exported: true,
          analyze: async () =>
            analyzeSvelteComponentFromSFC(resolver, absoluteFilePath + ".ts"),
        },
      },
    ];
  } else {
    const sourceFile = resolver.sourceFile(absoluteFilePath);
    if (!sourceFile) {
      return [];
    }
    return extractCsf3Stories(
      rootDirPath,
      resolver,
      sourceFile,
      async (componentId) => {
        const { filePath } = decodeComponentId(componentId);
        const component = (
          await extractSvelteComponents(
            reader,
            resolver,
            rootDirPath,
            path.join(rootDirPath, filePath)
          )
        ).find((c) => c.componentId === componentId);
        if (component?.info.kind !== "component") {
          return {
            propsType: UNKNOWN_TYPE,
            types: {},
          };
        }
        return component.info.analyze();
      }
    );
  }
}
