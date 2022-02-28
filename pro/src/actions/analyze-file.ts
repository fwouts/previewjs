import { Workspace } from "@previewjs/core";
import path from "path";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

export async function analyzeFile({
  workspace,
  filePath,
}: {
  workspace: Workspace;
  filePath: string;
}) {
  {
    const absoluteFilePath = path.join(workspace.rootDirPath, filePath);
    const components = (
      await workspace.frameworkPlugin.detectComponents(workspace.typeAnalyzer, [
        absoluteFilePath,
      ])
    ).map(({ name, exported }) => ({
      filePath: filePath.replace(/\\/g, "/"),
      key: name,
      label: name,
      componentName: name,
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
          const suffix = entry.name.substring(
            fileNameBase.length + 1,
            entry.name.length - ext.length
          );
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
                key: `${suffix}/${c.name}`,
                label: `${suffix}:${c.name}`,
                componentName: c.name,
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
