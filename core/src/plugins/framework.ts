import type { PreviewConfig } from "@previewjs/config";
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
  create(): Promise<FrameworkPlugin>;
}

export interface FrameworkPlugin {
  readonly pluginApiVersion?: number;
  readonly name: string;
  readonly defaultWrapperPath: string;
  readonly previewDirPath: string;
  readonly transformReader?: (reader: Reader, rootDirPath: string) => Reader;
  readonly tsCompilerOptions?: Partial<ts.CompilerOptions>;
  readonly specialTypes?: Record<string, ValueType>;
  readonly viteConfig: (config: PreviewConfig) => vite.UserConfig;
  readonly detectComponents: (
    typeAnalyzer: TypeAnalyzer,
    absoluteFilePaths: string[]
  ) => Promise<Component[]>;
}
export interface Component {
  readonly absoluteFilePath: string;
  readonly name: string;
  readonly exported: boolean;
  readonly offsets: Array<[start: number, end: number]>;
  readonly analyze: () => Promise<ComponentAnalysis>;
}

export interface ComponentAnalysis {
  propsType: ValueType;
  types: CollectedTypes;
  providedArgs: ReadonlySet<string>;
}
