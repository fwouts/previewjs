import inquirer from "inquirer";

export async function incrementVersion(oldVersion: string) {
  let [major, minor, patch] = oldVersion
    .split(".")
    .map((str: string) => parseInt(str));
  major ||= 0;
  minor ||= 0;
  patch ||= 0;
  const prompt = inquirer.createPromptModule();
  const { releaseType } = await prompt({
    name: "releaseType",
    type: "list",
    message: "Pick a release type",
    choices: ["patch", "minor", "major"],
  });
  switch (releaseType) {
    case "patch":
      patch += 1;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
  }
  const version = `${major}.${minor}.${patch}`;
  return version;
}
