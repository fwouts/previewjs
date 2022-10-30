import execa from "execa";

export async function gitChangelog(packageName: string, dirPaths: string[]) {
  const { stdout } = await execa("git", [
    "log",
    "--oneline",
    "--",
    ...dirPaths,
  ]);
  let commitMessages = stdout.split("\n");
  const lastReleaseIndex = commitMessages.findIndex((message) =>
    message.match(
      `^\\w+ release: .*${packageName.replace(
        /\//g,
        "\\/"
      )}@v?\\d+\\.\\d+\\.\\d+.*$`
    )
  );
  if (lastReleaseIndex !== -1) {
    commitMessages = commitMessages.slice(0, lastReleaseIndex);
  }
  return `${commitMessages.map((message) => `- ${message}`).join("\n")}`;
}
