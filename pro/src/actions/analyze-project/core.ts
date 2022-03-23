// This is meant to be invoked via fork() to analyze a project in a subprocess
// in order to prevent the parent process from freezing.

import { createWorkspace, loadPreviewEnv } from "@previewjs/core";
import { createFileSystemReader } from "@previewjs/vfs";
import path from "path";
import setupEnvironment from "../..";
import { ProjectComponents } from "../analyze-project";
import { findFiles } from "./find-files";

export async function analyzeProjectCore(
  rootDirPath: string
): Promise<ProjectComponents> {
  const loaded = await loadPreviewEnv({
    rootDirPath,
    setupEnvironment,
  });
  if (!loaded) {
    return {};
  }
  const { frameworkPlugin } = loaded;
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
  const absoluteFilePaths = await findFiles(
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
  const found = await frameworkPlugin.detectComponents(
    workspace.typeAnalyzer,
    absoluteFilePaths
  );
  for (const component of found) {
    const filePath = path.relative(rootDirPath, component.absoluteFilePath);
    const fileComponents = (components[filePath] ||= []);
    fileComponents.push({
      componentName: component.name,
      exported: component.exported,
    });
  }
  workspace.dispose();
  return components;
}
