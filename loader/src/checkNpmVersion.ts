import { execCommandPossiblyWsl } from "./exec";

export async function checkNpmVersion(cwd: string, forceWsl = false) {
  const { wsl, process: npmVersionProcess } = await execCommandPossiblyWsl(
    "node",
    ["-v"],
    {
      cwd,
      forceWsl,
    }
  );
  if (npmVersionProcess.failed) {
    throw new Error(
      `Preview.js was unable to run npm.\n\nYou can manually run "npm install" in ${cwd}\n\nYou will need to restart your IDE after doing so.`
    );
  }
  if (npmVersionProcess.exitCode !== 0) {
    throw new Error(
      `Preview.js was unable to run npm (exit code ${npmVersionProcess.exitCode}):\n\n${npmVersionProcess.stderr}\n\nYou can manually run "npm install" in ${cwd}\n\nYou will need to restart your IDE after doing so.`
    );
  }
  const npmVersion = npmVersionProcess.stdout;
  if (parseInt(npmVersion) < 6) {
    throw new Error(
      `Preview.js needs npm 6+ to run, but current version is: ${npmVersion}\n\nPlease upgrade then restart your IDE.`
    );
  }
  return { wsl };
}
