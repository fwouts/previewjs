import {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
  ReaderListeners,
} from "@previewjs/core/vfs";
import path from "path";
import ts from "typescript";
import { parseComponent } from "vue-template-compiler";

/**
 * Returns a reader that returns a virtual TypeScript file
 * named foo.vue.ts for every corresponding foo.vue file.
 */
export function createVueTypeScriptReader(reader: Reader): Reader {
  return new VueTypeScriptReader(reader);
}

class VueTypeScriptReader implements Reader {
  readonly listeners = new ReaderListeners();

  constructor(private readonly reader: Reader) {
    reader.listeners.add({
      onChange: (filePath, info) => {
        this.listeners.notify(filePath, info);
      },
    });
  }

  observe = this.reader.observe?.bind(this.reader);

  async read(filePath: string): Promise<File | Directory | null> {
    if (filePath.endsWith(".vue.ts")) {
      const source = await this.reader.read(
        filePath.substr(0, filePath.length - 3)
      );
      if (source?.kind !== "file") {
        return null;
      }
      const name = path.basename(filePath);
      return {
        kind: "file",
        name,
        realPath: async () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: async () => convertToTypeScript(await source.read(), name),
        size: () => source.size(),
      };
    }
    return this.reader.read(filePath);
  }

  readSync(filePath: string): FileSync | DirectorySync | null {
    if (filePath.endsWith(".vue.ts")) {
      const source = this.reader.readSync(
        filePath.substr(0, filePath.length - 3)
      );
      if (source?.kind !== "file") {
        return null;
      }
      const name = path.basename(filePath);
      return {
        kind: "file",
        name,
        realPath: () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: () => convertToTypeScript(source.read(), name),
        size: () => source.size(),
      };
    }
    return this.reader.readSync(filePath);
  }
}

function convertToTypeScript(vueTemplateSource: string, name: string) {
  const parsed = parseComponent(vueTemplateSource);
  // TODO: Ignore non-JS compatible languages (same with Vue 3).
  const scriptContent = parsed.script?.content;
  if (!scriptContent) {
    return "";
  }
  const sourceFile = ts.createSourceFile(
    `${name}.vue.ts`,
    scriptContent,
    ts.ScriptTarget.Latest
  );
  const transformation = ts.transform(sourceFile, [
    (context) => (sourceFile) => {
      if (ts.isSourceFile(sourceFile)) {
        return ts.visitEachChild(
          sourceFile,
          (node) => {
            if (ts.isExportAssignment(node)) {
              return ts.factory.createVariableStatement(
                [],
                ts.factory.createVariableDeclarationList(
                  [
                    ts.factory.createVariableDeclaration(
                      "pjs_component",
                      undefined,
                      undefined,
                      ts.factory.createAsExpression(
                        node.expression,
                        ts.factory.createTypeReferenceNode("const")
                      )
                    ),
                  ],
                  ts.NodeFlags.Const
                )
              );
            }
            return node;
          },
          context
        );
      }
      return sourceFile;
    },
  ]);
  const transformed = ts
    .createPrinter()
    .printFile(transformation.transformed[0]!);
  transformation.dispose();
  return `
${transformed}

import type {Prop as PJS_Prop} from 'vue/types/options';

type PJS_TypeOrUnion<T> = PJS_Prop<T> | ReadonlyArray<PJS_Prop<T>>;
type PJS_OptionalPropType<T> = PJS_TypeOrUnion<T> | {type: PJS_TypeOrUnion<T>; required?: false};
type PJS_RequiredPropType<T> = {type: PJS_TypeOrUnion<T>; required: true};
type PJS_OptionalPropsKeys<T> = {
  [K in keyof T]: T[K] extends PJS_OptionalPropType<any> ? K : never;
}[keyof T];
type PJS_RequiredPropsKeys<T> = {
  [K in keyof T]: T[K] extends PJS_RequiredPropType<any> ? K : never;
}[keyof T];
type PJS_CombinedProps<T> = T extends readonly [...any] ? {
  [K in T[number]]: unknown
} : ({
  [K in PJS_OptionalPropsKeys<T>]?: T[K] extends PJS_OptionalPropType<infer S> ? S : never;
} & {
  [K in PJS_RequiredPropsKeys<T>]: T[K] extends PJS_RequiredPropType<infer S> ? S : never;
});
type PJS_ExtractProps<T> = T extends { props: any } ? PJS_CombinedProps<T['props']> : {}
type PJS_Props = PJS_ExtractProps<typeof pjs_component>;
`;
}
