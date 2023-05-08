import { Node, Parser } from "acorn";
import jsx from "acorn-jsx";
import path from "path";
import type * as vite from "vite";

const jsExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"]);

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
      try {
        const parsed = parse(code);
        const topLevelEntityNames = findTopLevelEntityNames(parsed);
        code = exposeDefaultExport(code, parsed);
        return `${code};
          export {
          ${topLevelEntityNames
            .map((c) => `${c} as __previewjs__${c},`)
            .join("")}
        }`;
      } catch (e) {
        throw new Error(`Unable to parse ${id}: ${e}`);
      }
    },
  };
}

export function parse(code: string) {
  return Parser.extend(jsx()).parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
}

export function findTopLevelEntityNames(parsed: Node): string[] {
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
  return [...new Set(topLevelEntityNames)];
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

export function exposeDefaultExport(code: string, parsed: Node): string {
  for (const statement of (parsed as any).body || []) {
    if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration
    ) {
      if (statement.declaration.id) {
        // Default export has a name, e.g. "export default function f()".
        // It would be incorrect to wrap it into a variable declaration
        // because that would remove it from the top-level scope and break
        // hoisting.
        return `${code}\nconst pjs_defaultExport = ${statement.declaration.id.name};`;
      } else {
        return `${code.substring(
          0,
          statement.start
        )}const pjs_defaultExport = ${code.substring(
          statement.declaration.start,
          statement.declaration.end
        )};\nexport default pjs_defaultExport;${code.substring(statement.end)}`;
      }
    }
  }
  return code;
}
