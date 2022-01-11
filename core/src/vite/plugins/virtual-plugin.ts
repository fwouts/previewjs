import { Node, Parser } from "acorn";
import fs from "fs-extra";
import path from "path";
import * as vite from "vite";
import { transformWithEsbuild } from "vite";
import { Reader } from "../../vfs";

const VIRTUAL_PREFIX = `/@previewjs-virtual:`;

const jsExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

export function virtualPlugin(options: {
  reader: Reader;
  rootDirPath: string;
  moduleGraph: () => vite.ModuleGraph | null;
  esbuildOptions: vite.ESBuildOptions;
}): vite.Plugin {
  const { reader, rootDirPath } = options;
  return {
    name: "previewjs:virtual-fs",
    resolveId: async function (id, importer) {
      const virtualImporter = importer?.startsWith(VIRTUAL_PREFIX) || false;
      if (id.indexOf(`/node_modules/`) !== -1) {
        return null;
      }
      if (id.startsWith(VIRTUAL_PREFIX)) {
        id = id.slice(VIRTUAL_PREFIX.length);
      }
      const extension = path.extname(id);
      let absoluteId;
      if (path.isAbsolute(id)) {
        absoluteId = id;
      } else {
        if (!importer) {
          return null;
        }
        if (virtualImporter) {
          importer = importer.slice(VIRTUAL_PREFIX.length);
        }
        if (extension && !jsExtensions.has(extension) && extension !== ".svg") {
          // Virtual files mess with CSS processors like postcss.
          return path.join(path.dirname(importer), id);
        }
        absoluteId = path.join(path.dirname(importer), id);
      }
      const resolved = await resolveAbsoluteModuleId(absoluteId);
      if (resolved) {
        const [filePath] = resolved;
        if ((await fs.pathExists(filePath)) && !virtualImporter) {
          // This file doesn't need to be virtual.
          return null;
        }
        if (!absoluteId.endsWith(extension)) {
          absoluteId += extension;
        }
        const resolvedId = VIRTUAL_PREFIX + filePath.replace(/\\/g, "/");
        return resolvedId;
      }
      return null;
    },
    load: async function (id) {
      if (id.indexOf(`/node_modules/`) !== -1) {
        return null;
      }
      if (id.startsWith(VIRTUAL_PREFIX)) {
        id = id.slice(VIRTUAL_PREFIX.length);
      }
      const resolved = await resolveAbsoluteModuleId(id);
      if (!resolved) {
        // This could be a file handled by another plugin, e.g. CSS modules.
        return null;
      }
      const [filePath, entry] = resolved;
      if (entry.kind !== "file") {
        console.error(`Unable to read from ${filePath}`);
        return null;
      }
      let source = await entry.read();
      const fileExtension = path.extname(filePath);
      if (!jsExtensions.has(fileExtension)) {
        return source;
      }
      // Transform with esbuild so we can find top-level entity names.
      const transformed = {
        ...(await transformWithEsbuild(source, filePath, {
          loader: fileExtension === ".ts" ? "ts" : "tsx",
          format: "esm",
          sourcefile: path.relative(rootDirPath, filePath),
          ...options.esbuildOptions,
        })),
        // Prevent injectSourcesContent() from running on Vite side.
        // It could fail when the parent directory doesn't exist
        // (which is the case for __react_internal__ files).
        map: "{}",
      };
      const topLevelEntityNames = findTopLevelEntityNames(transformed.code);
      const moduleExtension = path.extname(id);
      return {
        code:
          // We do use the transform for .js because it may include JSX. Otherwise, let plugins decide whether
          // to use esbuild or not.
          (moduleExtension === "" || moduleExtension === ".js"
            ? transformed.code
            : source) +
          `;
          export {
          ${topLevelEntityNames
            .map((c) => `${c} as __previewjs__${c},`)
            .join("")}
        }`,
      };
    },
    handleHotUpdate: async function (context) {
      const moduleGraph = options.moduleGraph();
      if (!moduleGraph) {
        return;
      }
      const relativeFilePath = path.relative(rootDirPath, context.file);
      const filePath = path.join(rootDirPath, relativeFilePath);
      const entry = await reader.read(filePath);
      if (!entry || entry.kind !== "file") {
        return;
      }
      // Note: backslash handling is Windows-specific.
      const virtualModuleId = VIRTUAL_PREFIX + filePath.replace(/\\/g, "/");
      const node = moduleGraph.getModuleById(virtualModuleId);
      return node && [node];
    },
  };

  async function resolveAbsoluteModuleId(id: string) {
    return (
      (await resolveBaseFilePath(id)) ||
      (await resolveBaseFilePath(path.join(rootDirPath, id)))
    );
  }

  async function resolveBaseFilePath(baseFilePath: string) {
    for (const suffix of [
      "",
      ...jsExtensions,
      ...[...jsExtensions].map((extension) => `${path.sep}index${extension}`),
    ]) {
      const filePath = `${baseFilePath}${suffix}`;
      const entry = await reader.read(filePath);
      if (entry !== null) {
        return [filePath, entry] as const;
      }
    }
    return null;
  }
}

function findTopLevelEntityNames(source: string): string[] {
  let parsed: Node;
  try {
    parsed = Parser.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
  } catch (e) {
    console.warn(e);
    return [];
  }
  const topLevelEntityNames: string[] = [];
  // Note: acorn doesn't provide detailed typings.
  for (const statement of (parsed as any).body || []) {
    if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations) {
        if (declaration.type === "VariableDeclarator") {
          addIfIdentifier(topLevelEntityNames, declaration.id);
        }
      }
    }
    if (statement.type === "FunctionDeclaration") {
      addIfIdentifier(topLevelEntityNames, statement.id);
    }
    if (statement.type === "ClassDeclaration") {
      addIfIdentifier(topLevelEntityNames, statement.id);
    }
  }
  return topLevelEntityNames;
}

function addIfIdentifier(array: string[], id?: Node) {
  if (id && id.type === "Identifier") {
    const name = (id as any).name;
    if (name.endsWith("_default")) {
      return;
    }
    array.push(name);
  }
}
