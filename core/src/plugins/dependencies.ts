export type PackageDependencies = Record<
  string,
  {
    /** @deprecated */
    majorVersion: number;

    readInstalledVersion(): Promise<string | null>;
  }
>;
