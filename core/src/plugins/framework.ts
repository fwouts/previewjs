import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import type ts from "typescript";
import type vite from "vite";
import type { PackageDependencies } from "./dependencies";

export interface FrameworkPluginFactory {
  isCompatible(dependencies: PackageDependencies): Promise<boolean>;
  create(options: {
    rootDirPath: string;
    dependencies: PackageDependencies;
  }): Promise<FrameworkPlugin>;
}

export interface FrameworkPlugin {
  readonly pluginApiVersion?: number;
  readonly name: string;
  readonly defaultWrapperPath: string;
  readonly previewDirPath: string;
  readonly transformReader?: (reader: Reader) => Reader;
  readonly tsCompilerOptions?: Partial<ts.CompilerOptions>;
  readonly specialTypes?: Record<string, ValueType>;
  readonly viteConfig: () => vite.UserConfig;
  readonly incompatibleVitePlugins?: string[];
  readonly detectComponents: (
    typeAnalyzer: TypeAnalyzer,
    absoluteFilePaths: string[]
  ) => Promise<Component[]>;
}

export interface Component {
  readonly absoluteFilePath: string;
  readonly name: string;
  readonly offsets: Array<[start: number, end: number]>;
  readonly info: ComponentTypeInfo;
}

export type ComponentTypeInfo =
  | {
      kind: "component";
      readonly exported: boolean;
      readonly analyze: () => Promise<ComponentAnalysis>;
    }
  | {
      kind: "story";
      readonly associatedComponent: {
        readonly absoluteFilePath: string;
        readonly name: string;
      } | null;
    };

export interface ComponentAnalysis {
  propsType: ValueType;
  types: CollectedTypes;
}
