import {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
  ReaderListeners,
} from "@previewjs/vfs";
import { parse } from "@vue/compiler-sfc";
import path from "path";
import ts from "typescript";

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
      onChange: (absoluteFilePath, info) => {
        this.listeners.notify(absoluteFilePath, info);
      },
    });
  }

  observe = this.reader.observe?.bind(this.reader);

  async read(absoluteFilePath: string): Promise<File | Directory | null> {
    if (absoluteFilePath.endsWith(".vue.ts")) {
      const source = await this.reader.read(
        absoluteFilePath.substr(0, absoluteFilePath.length - 3)
      );
      if (source?.kind !== "file") {
        return null;
      }
      const name = path.basename(absoluteFilePath);
      return {
        kind: "file",
        name,
        realPath: async () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: async () => convertToTypeScript(await source.read(), name),
        size: () => source.size(),
      };
    }
    return this.reader.read(absoluteFilePath);
  }

  readSync(absoluteFilePath: string): FileSync | DirectorySync | null {
    if (absoluteFilePath.endsWith(".vue.ts")) {
      const source = this.reader.readSync(
        absoluteFilePath.substr(0, absoluteFilePath.length - 3)
      );
      if (source?.kind !== "file") {
        return null;
      }
      const name = path.basename(absoluteFilePath);
      return {
        kind: "file",
        name,
        realPath: () => null,
        lastModifiedMillis: () => source.lastModifiedMillis(),
        read: () => convertToTypeScript(source.read(), name),
        size: () => source.size(),
      };
    }
    return this.reader.readSync(absoluteFilePath);
  }
}

function convertToTypeScript(vueTemplateSource: string, name: string) {
  const parsed = parse(vueTemplateSource);
  if (parsed.descriptor.scriptSetup) {
    return `import { defineProps } from '@vue/runtime-core';\n${parsed.descriptor.scriptSetup.content}`;
  } else if (parsed.descriptor.script) {
    const lang = parsed.descriptor.script.lang;
    if (lang && !["js", "javascript", "ts", "typescript"].includes(lang)) {
      return "";
    }
    const scriptContent = parsed.descriptor.script.content;
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
                          extractDefineComponentArgument(node.expression),
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

import type { PropType as PJS_PropType } from "@vue/runtime-core";

type PJS_TypeOrUnion<T> = PJS_PropType<T> | ReadonlyArray<PJS_PropType<T>>;
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
  } else {
    return "";
  }
}

function extractDefineComponentArgument(node: ts.Expression): ts.Expression {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "defineComponent" &&
    node.arguments.length > 0
  ) {
    return node.arguments[0]!;
  }
  return node;
}
