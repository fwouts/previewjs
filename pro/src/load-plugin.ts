import { readConfig } from "@previewjs/config";
import { extractPackageDependencies, FrameworkPlugin } from "@previewjs/core";
import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { vue3FrameworkPlugin } from "@previewjs/plugin-vue3";

const frameworkPluginCandidates = [reactFrameworkPlugin, vue3FrameworkPlugin];

export async function loadFrameworkPlugin(
  rootDirPath: string
): Promise<FrameworkPlugin | null> {
  const config = readConfig(rootDirPath);
  if (config.frameworkPlugin) {
    return config.frameworkPlugin;
  }
  const dependencies = await extractPackageDependencies(rootDirPath);
  for (const candidate of frameworkPluginCandidates) {
    if (await candidate.isCompatible(dependencies)) {
      return candidate.create();
    }
  }
  return null;
}
