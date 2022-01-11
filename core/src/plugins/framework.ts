import { PreviewConfig } from "@previewjs/config";
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
  readonly tsCompilerOptions?: Partial<ts.CompilerOptions>;
  readonly componentDetector: ComponentDetector<Component>;
  viteConfig(config: PreviewConfig): vite.UserConfig;
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
