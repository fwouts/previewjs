// This is meant to be invoked via fork() to analyze a project in a subprocess
// in order to prevent the parent process from freezing.

// TODO: Centralise importing of framework plugins so they're always
// consistent between analyze-project and main.
import { createWorkspace } from "@previewjs/core";
import { createFileSystemReader } from "@previewjs/core/vfs";
import path from "path";
import { loadFrameworkPlugin } from "../../load-plugin";
import { ProjectComponents } from "../analyze-project";
import { findFiles } from "./find-files";

export async function analyzeProjectCore(
  rootDirPath: string
): Promise<ProjectComponents> {
  const frameworkPlugin = await loadFrameworkPlugin(rootDirPath);
  if (!frameworkPlugin) {
    return {};
  }
  const workspace = await createWorkspace({
    versionCode: "",
    rootDirPath,
    reader: createFileSystemReader(),
    frameworkPlugin,
    middlewares: [],
    logLevel: "silent",
  });
  if (!workspace) {
    return {};
  }
  const filePaths = await findFiles(
    rootDirPath,
    "**/*.@(js|jsx|tsx|svelte|vue)"
  );
  const components: Record<
    string,
    Array<{
      componentName: string;
      exported: boolean;
    }>
  > = {};
  const program = workspace.typescriptAnalyzer.analyze(filePaths);
  if (!program) {
    return {};
  }
  const found = frameworkPlugin.componentDetector(program, filePaths);
  for (const component of found) {
    const relativeFilePath = path.relative(rootDirPath, component.filePath);
    const fileComponents = (components[relativeFilePath] ||= []);
    fileComponents.push({
      componentName: component.name,
      exported: component.exported,
    });
  }
  workspace.dispose();
  return components;
}
