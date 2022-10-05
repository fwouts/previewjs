import execa from "execa";

export async function assertCleanGit() {
  const { stdout: gitBranch } = await execa("git", [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  if (gitBranch !== "main") {
    throw new Error(`You are trying to release the wrong branch: ${gitBranch}`);
  }
  const gitPorcelain = await gitPorcelainStatus();
  if (gitPorcelain) {
    throw new Error(`Git status is not clean:\n${gitPorcelain}`);
  }
}

export async function isGitClean() {
  return !(await gitPorcelainStatus());
}

async function gitPorcelainStatus() {
  const { stdout: gitPorcelain } = await execa("git", [
    "status",
    "--porcelain",
  ]);
  return gitPorcelain;
}
