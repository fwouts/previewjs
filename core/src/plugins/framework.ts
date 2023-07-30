import type { SerializableValue } from "@previewjs/serializable-values";
import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import type { Logger } from "pino";
import type vite from "vite";
import type { PackageDependencies } from "./dependencies";

export interface FrameworkPluginFactory {
  isCompatible(dependencies: PackageDependencies): Promise<boolean>;
  create(options: {
    rootDirPath: string;
    reader: Reader;
    logger: Logger;
    dependencies: PackageDependencies;
  }): Promise<FrameworkPlugin>;
}

export interface FrameworkPlugin {
  readonly pluginApiVersion?: number;
  readonly name: string;
  readonly defaultWrapperPath: string;
  readonly previewDirPath: string;
  readonly typeAnalyzer: TypeAnalyzer;
  readonly viteConfig: (configuredPlugins: vite.Plugin[]) => vite.UserConfig;
  readonly detectComponents: (
    absoluteFilePaths: string[]
  ) => Promise<AnalyzableComponent[]>;
}

export interface AnalyzableComponent {
  readonly componentId: string;
  readonly offsets: [start: number, end: number];
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
      readonly args: {
        start: number;
        end: number;
        value: SerializableValue;
      } | null;
      readonly associatedComponent: StoryAssociatedComponent | null;
    };

export type StoryAssociatedComponent = {
  readonly componentId: string;
  readonly analyze: () => Promise<ComponentAnalysis>;
};

export interface ComponentAnalysis {
  propsType: ValueType;
  types: CollectedTypes;
}
