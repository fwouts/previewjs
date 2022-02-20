import { PreviewConfig } from "@previewjs/config";
import {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import ts from "typescript";
import vite from "vite";
import { TypescriptAnalyzer } from "../ts-helpers";
import { Reader } from "../vfs";
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
  readonly viteConfig: (config: PreviewConfig) => vite.UserConfig;
  readonly componentDetector: ComponentDetector<Component>;
  readonly componentAnalyzer?: (options: {
    typescriptAnalyzer: TypescriptAnalyzer;
    getTypeAnalyzer(
      program: ts.Program,
      specialTypes?: Record<string, ValueType>
    ): TypeAnalyzer;
  }) => ComponentAnalyzer;
}

export type ComponentDetector<
  Component extends DetectedComponent = DetectedComponent
> = (program: ts.Program, filePaths: string[]) => Component[];

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
