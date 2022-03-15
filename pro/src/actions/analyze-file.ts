import { Workspace } from "@previewjs/core";
import path from "path";
import { Component } from "../api/endpoints";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

export async function analyzeFile({
  workspace,
  filePath,
}: {
  workspace: Workspace;
  filePath: string;
}): Promise<Component[]> {
  {
    const absoluteFilePath = path.join(workspace.rootDirPath, filePath);
    const components: Component[] = (
      await workspace.frameworkPlugin.detectComponents(workspace.typeAnalyzer, [
        absoluteFilePath,
      ])
    ).map(({ name, exported }) => ({
      filePath: filePath.replace(/\\/g, "/"),
      key: name,
      type: "component",
      name: name,
      exported,
    }));
    const fileName = path.basename(absoluteFilePath);
    const fileNameBase = fileName.substr(
      0,
      fileName.length - path.extname(fileName).length
    );
    const dirPath = path.dirname(absoluteFilePath);
    const dir = await workspace.reader.read(dirPath);
    if (dir?.kind === "directory") {
      for (const entry of await dir.entries()) {
        const ext = path.extname(entry.name);
        if (
          entry.kind === "file" &&
          entry.name !== fileName &&
          // This could be A.stories.tsx or A.screenshot.tsx, etc.
          entry.name
            .toLowerCase()
            .startsWith(fileNameBase.toLowerCase() + ".") &&
          JS_EXTENSIONS.has(ext)
        ) {
          const siblingAbsoluteFilePath = path.join(dirPath, entry.name);
          const siblingFilePath = path.relative(
            workspace.rootDirPath,
            path.join(dirPath, entry.name)
          );
          const type: "story" | "component" =
            entry.name.includes(".stories.") || entry.name.includes(".story.")
              ? "story"
              : "component";
          components.push(
            ...(
              await workspace.frameworkPlugin.detectComponents(
                workspace.typeAnalyzer,
                [siblingAbsoluteFilePath]
              )
            )
              .filter((c) => c.exported)
              .map((c) => ({
                filePath: siblingFilePath.replace(/\\/g, "/"),
                key: `${entry.name}/${c.name}`,
                type,
                name: c.name,
                exported: true,
              }))
          );
        }
      }
    }
    components.sort((a, b) => {
      if (a.exported && !b.exported) {
        return -1;
      }
      if (b.exported && !a.exported) {
        return +1;
      }
      if (a.type === "component" && b.type === "story") {
        return -1;
      }
      if (b.type === "component" && a.type === "story") {
        return +1;
      }
      return a.name.localeCompare(b.name);
    });
    return components;
  }
}
