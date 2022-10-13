import fs from "fs";

export function getPackageJson(absoluteFilePath: string) {
  return new PackageJsonModifier(absoluteFilePath);
}

class PackageJsonModifier {
  constructor(readonly absoluteFilePath: string) {}

  async read() {
    return JSON.parse(
      await fs.promises.readFile(this.absoluteFilePath, "utf8")
    );
  }

  async updateVersion(version: string) {
    const { name, version: _oldVersion, ...packageInfo } = await this.read();
    await this.write({
      name,
      version,
      ...packageInfo,
    });
  }

  async updateDependency(name: string, version: string) {
    const {
      dependencies = {},
      devDependencies = {},
      ...packageInfo
    } = await this.read();
    await this.write({
      ...packageInfo,
      dependencies: Object.fromEntries(
        Object.entries(dependencies).map(([depName, depVersion]) => [
          depName,
          depName === name ? `^${version}` : depVersion,
        ])
      ),
      devDependencies,
    });
  }

  private async write(info: unknown) {
    await fs.promises.writeFile(
      this.absoluteFilePath,
      JSON.stringify(info, null, 2) + "\n",
      "utf8"
    );
  }
}
