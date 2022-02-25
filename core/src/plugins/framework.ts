import { PreviewConfig } from "@previewjs/config";
import {
  CollectedTypes,
  TypeAnalyzer,
  TypeResolver,
  ValueType,
} from "@previewjs/type-analyzer";
import { Reader } from "@previewjs/vfs";
import ts from "typescript";
import vite from "vite";
import { PackageDependencies } from "./dependencies";

export interface FrameworkPluginFactory<
  Options = {},
  Component extends DetectedComponent = DetectedComponent
> {
  isCompatible(dependencies: PackageDependencies): Promise<boolean>;
  create(options?: Options): Promise<FrameworkPlugin<Component>>;
}

export interface FrameworkPlugin<
  Component extends DetectedComponent = DetectedComponent
> {
  readonly name: string;
  readonly defaultWrapperPath: string;
  readonly previewDirPath: string;
  readonly transformReader?: (reader: Reader, rootDirPath: string) => Reader;
  readonly tsCompilerOptions?: Partial<ts.CompilerOptions>;
  readonly specialTypes?: Record<string, ValueType>;
  readonly viteConfig: (config: PreviewConfig) => vite.UserConfig;
  readonly componentDetector: ComponentDetector<Component>;
  readonly componentAnalyzer?: (options: {
    typeAnalyzer: TypeAnalyzer;
  }) => ComponentAnalyzer;
}

export type ComponentDetector<
  Component extends DetectedComponent = DetectedComponent
> = (resolver: TypeResolver, filePaths: string[]) => Component[];

export interface DetectedComponent {
  filePath: string;
  name: string;
  exported: boolean;
  offsets: Array<[start: number, end: number]>;
}

export type ComponentAnalyzer = (
  filePath: string,
  componentName: string
) => AnalyzedComponent;

export interface AnalyzedComponent {
  name: string;
  propsType: ValueType;
  types: CollectedTypes;
  providedArgs: ReadonlySet<string>;
}
