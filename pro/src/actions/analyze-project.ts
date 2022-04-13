import {
  createWorkspace,
  loadPreviewEnv,
  ProjectAnalysis,
} from "@previewjs/core";
import { createFileSystemReader } from "@previewjs/vfs";
import { fork } from "child_process";
import path from "path";
import setupEnvironment from "..";

export async function analyzeProject(
  rootDirPath: string,
  options: {
    blocking?: boolean;
    forceRefresh?: boolean;
  } = {}
) {
  const loaded = await loadPreviewEnv({
    rootDirPath,
    setupEnvironment,
  });
  if (!loaded) {
    throw new Error(`Unable to create preview environment`);
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
    throw new Error(`Unable to create workspace`);
  }
  // Jest + TypeScript + fork = unhappy days.
  const blocking = options.blocking || !!process.env["JEST_WORKER_ID"];
  if (blocking) {
    return await workspace.components.list(options);
  }
  const subprocess = fork(
    path.join(__dirname, "analyze-project", "subprocess"),
    [
      rootDirPath,
      JSON.stringify({
        ...options,
        blocking: true,
      }),
    ],
    {
      cwd: process.cwd(),
      silent: true,
    }
  );
  subprocess.stderr!.pipe(process.stderr);
  let subprocessErrorOutput = "";
  subprocess.stderr!.on("data", (data) => {
    subprocessErrorOutput += `${data}`;
  });
  const components = await new Promise<ProjectAnalysis>((resolve, reject) => {
    subprocess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(subprocessErrorOutput));
      }
    });
    subprocess.on("message", resolve);
  });
  return components;
}
