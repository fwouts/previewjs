// @ts-ignore untyped
import svgr from "@svgr/core";
import fs from "fs-extra";
import path from "path";
import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";

export function svgrPlugin({
  exportedComponentName,
  alias,
}: {
  exportedComponentName: string;
  alias: Record<string, string>;
}): Plugin {
  return {
    name: "previewjs:svgr",
    async transform(code, id) {
      if (!id.endsWith(".svg")) {
        return;
      }
      // ID can either be an absolute path (when SVG is imported with
      // ./logo.svg) or a relative path (when SVG is imported through an
      // alias like foo/logo.svg).
      let absoluteFilePath = id;
      for (const [mapFrom, mapTo] of Object.entries(alias)) {
        const matchStart = path.join(path.sep, mapFrom);
        if (id.startsWith(matchStart)) {
          absoluteFilePath = path.join(mapTo, path.relative(matchStart, id));
        }
      }
      let componentCode: string;
      if (await fs.pathExists(absoluteFilePath)) {
        const svg = await fs.readFile(absoluteFilePath, "utf8");
        const generatedSvgrCode: string = await svgr(
          svg,
          {},
          { componentName: "ReactComponent" }
        );
        componentCode = generatedSvgrCode.replace(
          "export default ReactComponent",
          `export { ReactComponent as ${exportedComponentName} }`
        );
      } else {
        componentCode = `
import React from 'react';

export const ${exportedComponentName} = () => <div>
  Unable to resolve ${id}
</div>;
        `;
      }
      const res = await transformWithEsbuild(
        (exportedComponentName !== "default" ? code : "") +
          "\n" +
          componentCode,
        absoluteFilePath,
        {
          loader: "jsx",
        }
      );
      return {
        code: res.code,
      };
    },
  };
}
