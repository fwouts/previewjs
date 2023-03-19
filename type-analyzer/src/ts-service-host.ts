import type { Reader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";

export function typescriptServiceHost(options: {
  rootDirPath: string;
  reader: Reader;
  getScriptFileNames: () => string[];
  tsCompilerOptions?: Partial<ts.CompilerOptions>;
}): ts.LanguageServiceHost {
  const readFile = (absoluteFilePath: string) => {
    const entry = options.reader.readSync(absoluteFilePath);
    if (entry?.kind !== "file") {
      return;
    }
    return entry.read();
  };
  return {
    getScriptFileNames: options.getScriptFileNames,
    getScriptVersion: (fileName) => {
      const entry = options.reader.readSync(fileName);
      if (!entry || entry.kind !== "file") {
        return "";
      }
      return entry.lastModifiedMillis().toString();
    },
    getScriptSnapshot: (fileName) => {
      const entry = options.reader.readSync(fileName);
      if (!entry || entry.kind !== "file") {
        return;
      }
      return ts.ScriptSnapshot.fromString(entry.read());
    },
    getCurrentDirectory: () => options.rootDirPath,
    getCompilationSettings: () => {
      const paths: ts.MapLike<string[]> = {};
      const configPath = path.join(options.rootDirPath, "tsconfig.json");
      const { config } = ts.readConfigFile(configPath, readFile);
      // TypeScript doesn't seem to be happy with relative paths,
      // even if we set getCurrentDirectory() to rootDirPath.
      // Instead, we convert all path mappings to absolute paths.
      const baseUrl = config.compilerOptions?.baseUrl || ".";
      const originalPaths: ts.MapLike<string[]> =
        config.compilerOptions?.paths || {};
      for (const [mapFrom, mapTo] of Object.entries(originalPaths)) {
        paths[mapFrom] = mapTo.map((m) =>
          path.join(options.rootDirPath, baseUrl, m)
        );
      }
      return {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        allowJs: true,
        strict: true,
        skipLibCheck: true,
        jsx: ts.JsxEmit.Preserve,
        baseUrl,
        paths,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        resolveJsonModule: true,
        ...options.tsCompilerOptions,
      };
    },
    getDefaultLibFileName: ts.sys ? ts.getDefaultLibFileName : () => "lib.d.ts",
    fileExists: (absoluteFilePath) =>
      options.reader.readSync(absoluteFilePath)?.kind === "file",
    directoryExists: (directoryName) =>
      options.reader.readSync(directoryName)?.kind === "directory",
    readFile,
    readDirectory: () => {
      throw new Error(`readDirectory is not implemented`);
    },
    getDirectories: (directoryName) => {
      const entry = options.reader.readSync(directoryName);
      if (entry?.kind !== "directory") {
        return [];
      }
      return entry
        .entries()
        .filter((entry) => entry.kind === "directory")
        .map((entry) => entry.name);
    },
  };
}
