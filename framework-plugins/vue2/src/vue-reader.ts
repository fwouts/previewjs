import type {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
} from "@previewjs/vfs";
import { ReaderListeners } from "@previewjs/vfs";
import path from "path";
import type { Logger } from "pino";
import ts from "typescript";
import type { ASTElement } from "vue-template-compiler";
import { compile, parseComponent } from "vue-template-compiler";

/**
 * Returns a reader that returns a virtual TypeScript file
 * named foo.vue.ts for every corresponding foo.vue file.
 */
export function createVueTypeScriptReader(
  logger: Logger,
  reader: Reader
): Reader {
  return new VueTypeScriptReader(logger, reader);
}

class VueTypeScriptReader implements Reader {
  readonly listeners = new ReaderListeners();

  observe?(path: string): Promise<() => Promise<void>>;

  constructor(
    private readonly logger: Logger,
    private readonly reader: Reader
  ) {
    reader.listeners.add({
      onChange: (absoluteFilePath, info) => {
        this.listeners.notify(absoluteFilePath, info);
      },
    });
    this.observe = reader.observe?.bind(reader);
  }

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
        read: async () => this.convertToTypeScript(await source.read(), name),
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
        read: () => this.convertToTypeScript(source.read(), name),
        size: () => source.size(),
      };
    }
    const entry = this.reader.readSync(absoluteFilePath);
    if (
      entry?.kind === "file" &&
      (entry.name.endsWith(".jsx") || entry.name.endsWith(".tsx"))
    ) {
      return {
        ...entry,
        read: () => `/// <reference types="vue/types/jsx" />\n${entry.read()}`,
      };
    }
    return entry;
  }

  private convertToTypeScript(vueTemplateSource: string, name: string) {
    const parsed = parseComponent(vueTemplateSource);
    const scriptContent = parsed.script?.content || "export default {}";
    const lang = parsed.script?.lang;
    if (lang && !["js", "javascript", "ts", "typescript"].includes(lang)) {
      return scriptContent;
    }
    const sourceFile = ts.createSourceFile(
      `${name}.vue.ts`,
      scriptContent,
      ts.ScriptTarget.Latest
    );
    let component: ts.Expression | null = null;
    for (const node of sourceFile.statements) {
      if (ts.isExportAssignment(node)) {
        component = node.expression;
      } else if (
        ts.isClassDeclaration(node) &&
        node.modifiers?.find((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
        node.modifiers?.find((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
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
            const [decorator] = ts.canHaveDecorators(member)
              ? ts.getDecorators(member) || []
              : [];
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
                                  ts.factory.createIdentifier("undefined"),
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
                    ts.factory.createPropertyAssignment(member.name, options)
                  );
                }
              }
            }
          }
        }
        component = ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment(
            "props",
            ts.factory.createObjectLiteralExpression(extractedProps)
          ),
        ]);
      }
    }
    let pjsComponentDeclaration = "const pjs_component = null;";
    if (component) {
      pjsComponentDeclaration = ts
        .createPrinter()
        .printFile(
          ts.factory.createSourceFile(
            [
              ts.factory.createVariableStatement(
                [],
                ts.factory.createVariableDeclarationList(
                  [
                    ts.factory.createVariableDeclaration(
                      "pjs_component",
                      undefined,
                      undefined,
                      ts.isObjectLiteralExpression(component)
                        ? ts.factory.createAsExpression(
                            component,
                            ts.factory.createTypeReferenceNode("const")
                          )
                        : component
                    ),
                  ],
                  ts.NodeFlags.Const
                )
              ),
            ],
            ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
            0
          )
        );
    }
    let pjsSlotsType = "[]";
    if (parsed.template) {
      const compiled = compile(parsed.template?.content);
      if (compiled.ast) {
        const slots = this.extractSlots(compiled.ast);
        pjsSlotsType = `[${slots
          .map((slotName) => JSON.stringify(slotName))
          .join(", ")}]`;
      }
    }
    return `
${scriptContent}
${pjsComponentDeclaration}

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
type PJS_Slots = ${pjsSlotsType};
`;
  }

  private extractSlots(element: ASTElement): string[] {
    if (element.tag === "slot") {
      const slotNameDoubleQuoted = element.slotName || '"default"';
      try {
        return [JSON.parse(slotNameDoubleQuoted)];
      } catch {
        this.logger.warn(`Invalid slot name string: ${slotNameDoubleQuoted}`);
        return [];
      }
    }
    const result: string[] = [];
    for (const child of element.children) {
      if (child.type === 1) {
        result.push(...this.extractSlots(child));
      }
    }
    return result;
  }
}
