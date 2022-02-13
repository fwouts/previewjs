import path from "path";
import ts from "typescript";
import { Reader } from "../vfs";

export interface TypescriptAnalyzer {
  analyze(filePaths: string[]): ts.Program;
  dispose(): void;
}

export function createTypescriptAnalyzer(options: {
  rootDirPath: string;
  reader: Reader;
  tsCompilerOptions?: Partial<ts.CompilerOptions>;
}): TypescriptAnalyzer {
  let entryPointFilePaths: string[] = [];
  const serviceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => {
      return entryPointFilePaths;
    },
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
      const { config } = ts.readConfigFile(configPath, serviceHost.readFile!);
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
        jsx: options.tsCompilerOptions?.jsx || ts.JsxEmit.Preserve,
        jsxImportSource: options.tsCompilerOptions?.jsxImportSource,
        baseUrl,
        paths,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        resolveJsonModule: true,
      };
    },
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: (filePath) =>
      options.reader.readSync(filePath)?.kind === "file",
    directoryExists: (directoryName) =>
      options.reader.readSync(directoryName)?.kind === "directory",
    readFile: (filePath) => {
      const entry = options.reader.readSync(filePath);
      if (entry?.kind !== "file") {
        return;
      }
      return entry.read();
    },
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
  const service = ts.createLanguageService(
    serviceHost,
    ts.createDocumentRegistry()
  );

  return {
    analyze(filePaths) {
      entryPointFilePaths = filePaths;
      const program = service.getProgram();
      if (!program) {
        throw new Error(`No program available.`);
      }
      return program;
    },
    dispose() {
      service.dispose();
    },
  };
}
