import { Workspace } from "@previewjs/core";
import path from "path";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

export async function analyzeFile({
  workspace,
  relativeFilePath,
}: {
  workspace: Workspace;
  relativeFilePath: string;
}) {
  {
    const filePath = path.join(workspace.rootDirPath, relativeFilePath);
    const components = (await workspace.detectComponents(filePath)).map(
      ({ componentName, exported }) => ({
        relativeFilePath: relativeFilePath.replace(/\\/g, "/"),
        key: componentName,
        label: componentName,
        componentName,
        exported,
      })
    );
    const fileName = path.basename(filePath);
    const fileNameBase = fileName.substr(
      0,
      fileName.length - path.extname(fileName).length
    );
    const dirPath = path.dirname(filePath);
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
          const siblingFilePath = path.join(dirPath, entry.name);
          const relativeSiblingFilePath = path.relative(
            workspace.rootDirPath,
            path.join(dirPath, entry.name)
          );
          const suffix = entry.name.substring(
            fileNameBase.length + 1,
            entry.name.length - ext.length
          );
          components.push(
            ...(await workspace.detectComponents(siblingFilePath))
              .filter((c) => c.exported)
              .map((c) => ({
                relativeFilePath: relativeSiblingFilePath.replace(/\\/g, "/"),
                key: `${suffix}/${c.componentName}`,
                label: `${suffix}:${c.componentName}`,
                componentName: c.componentName,
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
      const aColon = a.label.indexOf(":");
      const bColon = b.label.indexOf(":");
      if (aColon === -1 && bColon !== -1) {
        return -1;
      }
      if (aColon !== -1 && bColon === -1) {
        return +1;
      }
      return a.label.localeCompare(b.label);
    });
    return components;
  }
}
