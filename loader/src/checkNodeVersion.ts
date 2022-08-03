import execa from "execa";

export async function checkNodeVersion(cwd: string) {
  const nodeVersionProcess = await execa("node", ["-v"], {
    cwd,
    reject: false,
  });
  if (nodeVersionProcess.failed) {
    throw new Error(
      `Preview.js was unable to run node.\n\nIs it installed? You may need to restart your IDE.`
    );
  }
  if (nodeVersionProcess.exitCode !== 0) {
    throw new Error(
      `Preview.js was unable to run node (exit code ${nodeVersionProcess.exitCode}):\n\n${nodeVersionProcess.stderr}`
    );
  }
  const nodeVersion = nodeVersionProcess.stdout;
  if (parseInt(nodeVersion) < 14) {
    throw new Error(
      `Preview.js needs NodeJS 14+ to run, but current version is: ${nodeVersion}\n\nPlease upgrade then restart your IDE.`
    );
  }
}
