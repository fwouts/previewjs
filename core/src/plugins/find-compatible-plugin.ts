import type { Logger } from "pino";
import { extractPackageDependencies } from "./dependencies.js";
import type { FrameworkPluginFactory } from "./framework.js";

export async function findCompatiblePlugin(
  logger: Logger,
  rootDir: string,
  frameworkPlugins: FrameworkPluginFactory[]
) {
  const dependencies = await extractPackageDependencies(logger, rootDir);
  for (const candidate of frameworkPlugins) {
    if (!candidate.info) {
      continue;
    }
    if (await candidate.isCompatible(dependencies)) {
      return candidate.info!.name;
    }
  }
  return null;
}
