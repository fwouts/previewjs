import {
  factoryWithDefaultOptions,
  type Component,
} from "@previewjs/component-detection-api";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";
import { extractReactComponents } from "./extract-component.js";
import { REACT_SPECIAL_TYPES } from "./special-types.js";

export const createComponentDetector = factoryWithDefaultOptions(
  ({ rootDir, reader, logger }) => {
    const typeAnalyzer = createTypeAnalyzer({
      reader,
      rootDir,
      specialTypes: REACT_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "react",
      },
      warn: logger.warn.bind(logger),
    });
    return {
      typeAnalyzer,
      detectComponents: async (filePaths) => {
        const absoluteFilePaths = filePaths.map((f) => path.join(rootDir, f));
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          components.push(
            ...extractReactComponents(
              logger,
              resolver,
              rootDir,
              absoluteFilePath
            )
          );
          // Ensure this potentially long-running function doesn't block the thread.
          await 0;
        }
        return components;
      },
      dispose: () => {
        typeAnalyzer.dispose();
      },
    };
  }
);
