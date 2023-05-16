import type {
  Directory,
  DirectorySync,
  File,
  FileSync,
  Reader,
} from "@previewjs/vfs";
import { ReaderListeners } from "@previewjs/vfs";
import type { ElementNode } from "@vue/compiler-core";
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

  observe?(path: string): Promise<() => Promise<void>>;

  constructor(private readonly reader: Reader) {
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
    const entry = this.reader.readSync(absoluteFilePath);
    if (
      entry?.kind === "file" &&
      (entry.name.endsWith(".jsx") || entry.name.endsWith(".tsx"))
    ) {
      return {
        ...entry,
        read: () =>
          `/// <reference types="@vue/runtime-dom" />\n${entry.read()}`,
      };
    }
    return entry;
  }
}

function convertToTypeScript(vueTemplateSource: string, name: string) {
  const parsed = parse(vueTemplateSource);
  let pjsSlotsType = "[]";
  if (parsed.descriptor.template) {
    const slots = extractSlots(parsed.descriptor.template.ast);
    pjsSlotsType = `[${slots
      .map((slotName) => JSON.stringify(slotName))
      .join(", ")}]`;
  }
  const pjsSlotsTypeDeclaration = `type PJS_Slots = ${pjsSlotsType};`;
  if (parsed.descriptor.scriptSetup) {
    return `import { defineProps } from '@vue/runtime-core';\n${parsed.descriptor.scriptSetup.content}\nexport default {};${pjsSlotsTypeDeclaration}`;
  } else if (parsed.descriptor.script) {
    const lang = parsed.descriptor.script.lang;
    if (lang && !["js", "javascript", "ts", "typescript"].includes(lang)) {
      return "export default {}";
    }
    const scriptContent = parsed.descriptor.script.content;
    const sourceFile = ts.createSourceFile(
      `${name}.vue.ts`,
      scriptContent,
      ts.ScriptTarget.Latest
    );
    let component: ts.Expression | null = null;
    for (const node of sourceFile.statements) {
      if (ts.isExportAssignment(node)) {
        component = extractDefineComponentArgument(node.expression);
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
    return `
${scriptContent}
${pjsComponentDeclaration}

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
${pjsSlotsTypeDeclaration}
`;
  } else {
    return `export default {};${pjsSlotsTypeDeclaration}`;
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

function extractSlots(element: ElementNode): string[] {
  namedSlot: if (element.tag === "slot") {
    let slotName = "default";
    for (const prop of element.props) {
      if (prop.name === "name" && prop.type === 6 && prop.value) {
        slotName = prop.value.content;
      }
      if (
        prop.name === "bind" &&
        prop.type === 7 &&
        prop.arg?.type === 4 &&
        prop.arg.content === "name"
      ) {
        // Dynamic slot name, we don't know how to handle this.
        break namedSlot;
      }
    }
    return [slotName];
  }
  const result: string[] = [];
  for (const child of element.children) {
    if (child.type === 1) {
      result.push(...extractSlots(child));
    }
  }
  return result;
}
