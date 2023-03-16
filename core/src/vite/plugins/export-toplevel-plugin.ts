import { Node, Parser } from "acorn";
import path from "path";
import type * as vite from "vite";

const jsExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

export function exportToplevelPlugin(): vite.Plugin {
  return {
    name: "previewjs:export-toplevel",
    enforce: "post",
    transform: async function (code, id) {
      if (id.indexOf(`/node_modules/`) !== -1) {
        return null;
      }
      // Remove query params.
      id = id.split("?", 2)[0]!;
      const extension = path.extname(id);
      if (!jsExtensions.has(extension)) {
        return null;
      }
      const topLevelEntityNames = findTopLevelEntityNames(id, code);
      return `${code};
          export {
          ${topLevelEntityNames
            .map((c) => `${c} as __previewjs__${c},`)
            .join("")}
        }`;
    },
  };
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
    if (statement.type === "ExportDefaultDeclaration") {
      if (statement.declaration?.id) {
        addIfIdentifier(topLevelEntityNames, statement.declaration.id);
      }
    }
    if (statement.type === "ExportNamedDeclaration") {
      if (statement.declaration?.id) {
        addIfIdentifier(topLevelEntityNames, statement.declaration.id);
      }
      if (statement.declaration?.declarations) {
        for (const declarator of statement.declaration.declarations) {
          addIfIdentifier(topLevelEntityNames, declarator.id);
        }
      }
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
