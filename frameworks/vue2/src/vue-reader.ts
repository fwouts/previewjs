import {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
  ReaderListeners,
} from "@previewjs/vfs";
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
  const parsed = parseComponent(vueTemplateSource);
  const scriptContent = parsed.script?.content;
  if (!scriptContent) {
    return "";
  }
  const lang = parsed.script?.lang;
  if (lang && !["js", "javascript", "ts", "typescript"].includes(lang)) {
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
            if (
              ts.isClassDeclaration(node) &&
              node.modifiers?.find(
                (m) => m.kind === ts.SyntaxKind.ExportKeyword
              ) &&
              node.modifiers?.find(
                (m) => m.kind === ts.SyntaxKind.DefaultKeyword
              )
            ) {
              // When we encounter a class declaration that uses vue-property-decorator,
              // we'll transform it into a pjs_component definition.
              //
              // For example:
              //
              // @Component
              // export default class Button extends Vue {
              //   @Prop({ type: String, default: 'default' }) readonly size!: ButtonSize;
              // }
              //
              // will become:
              //
              // const pjs_component = {
              //   props: {
              //     size: {
              //       default: "default",
              //       type: (): Size => { return undefined as any; }
              //     }
              //   }
              // } as const;
              const extractedProps: ts.PropertyAssignment[] = [];
              for (const member of node.members) {
                if (ts.isPropertyDeclaration(member)) {
                  const [decorator] = member.decorators || [];
                  if (
                    decorator &&
                    ts.isCallExpression(decorator.expression) &&
                    ts.isIdentifier(decorator.expression.expression) &&
                    decorator.expression.expression.text === "Prop"
                  ) {
                    const [options] = decorator.expression.arguments;
                    if (options && ts.isObjectLiteralExpression(options)) {
                      if (member.type) {
                        extractedProps.push(
                          ts.factory.createPropertyAssignment(
                            member.name,
                            ts.factory.createObjectLiteralExpression([
                              ...options.properties.filter(
                                (p) =>
                                  p.name &&
                                  ts.isIdentifier(p.name) &&
                                  p.name.text !== "type"
                              ),
                              ts.factory.createPropertyAssignment(
                                "type",
                                ts.factory.createArrowFunction(
                                  [],
                                  [],
                                  [],
                                  member.type,
                                  undefined,
                                  ts.factory.createBlock([
                                    ts.factory.createReturnStatement(
                                      ts.factory.createAsExpression(
                                        ts.factory.createIdentifier(
                                          "undefined"
                                        ),
                                        ts.factory.createKeywordTypeNode(
                                          ts.SyntaxKind.AnyKeyword
                                        )
                                      )
                                    ),
                                  ])
                                )
                              ),
                            ])
                          )
                        );
                      } else {
                        extractedProps.push(
                          ts.factory.createPropertyAssignment(
                            member.name,
                            options
                          )
                        );
                      }
                    }
                  }
                }
              }
              return ts.factory.createVariableStatement(
                [],
                ts.factory.createVariableDeclarationList(
                  [
                    ts.factory.createVariableDeclaration(
                      "pjs_component",
                      undefined,
                      undefined,
                      ts.factory.createAsExpression(
                        ts.factory.createObjectLiteralExpression([
                          ts.factory.createPropertyAssignment(
                            "props",
                            ts.factory.createObjectLiteralExpression(
                              extractedProps
                            )
                          ),
                        ]),
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
