import { Reader } from "@previewjs/vfs";
import { Node, Parser } from "acorn";
import fs from "fs-extra";
import path from "path";
import * as vite from "vite";
import { transformWithEsbuild } from "vite";

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
        const [absoluteFilePath] = resolved;
        if ((await fs.pathExists(absoluteFilePath)) && !virtualImporter) {
          // This file doesn't need to be virtual.
          return null;
        }
        if (!absoluteId.endsWith(extension)) {
          absoluteId += extension;
        }
        const resolvedId =
          VIRTUAL_PREFIX + absoluteFilePath.replace(/\\/g, "/");
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
      const [absoluteFilePath, entry] = resolved;
      if (entry.kind !== "file") {
        console.error(`Unable to read from ${absoluteFilePath}`);
        return null;
      }
      let source = await entry.read();
      const fileExtension = path.extname(absoluteFilePath);
      if (!jsExtensions.has(fileExtension)) {
        return source;
      }
      const filePath = path.relative(rootDirPath, absoluteFilePath);
      const topLevelEntityNames = findTopLevelEntityNames(filePath, source);
      return {
        code:
          // We do use the transform for .js because it may include JSX. Otherwise, let plugins decide whether
          // to use esbuild or not.
          (fileExtension === ".js"
            ? (
                await transformWithEsbuild(source, absoluteFilePath, {
                  loader: "tsx",
                  format: "esm",
                  sourcefile: filePath,
                  ...options.esbuildOptions,
                })
              ).code
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
      const filePath = path.relative(rootDirPath, context.file);
      const absoluteFilePath = path.join(rootDirPath, filePath);
      const entry = await reader.read(absoluteFilePath);
      if (!entry || entry.kind !== "file") {
        return;
      }
      // Note: backslash handling is Windows-specific.
      const virtualModuleId =
        VIRTUAL_PREFIX + absoluteFilePath.replace(/\\/g, "/");
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
      const absoluteFilePath = `${baseFilePath}${suffix}`;
      const entry = await reader.read(absoluteFilePath);
      if (entry !== null) {
        return [absoluteFilePath, entry] as const;
      }
    }
    return null;
  }
}

function findTopLevelEntityNames(filePath: string, source: string): string[] {
  let parsed: Node;
  try {
    parsed = Parser.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
  } catch (e) {
    throw new Error(`Unable to parse ${filePath} with Acorn: ${e}`);
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
