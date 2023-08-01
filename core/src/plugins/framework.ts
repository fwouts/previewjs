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
    rootDir: string;
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
  ) => Promise<Component[]>;
}

export interface BaseComponent {
  componentId: string;
  offsets: [start: number, end: number];
}

export type Component = FrameworkComponent | StoryComponent;

export interface FrameworkComponent extends BaseComponent {
  kind: "component";
  exported: boolean;
  extractProps: () => Promise<ComponentProps>;
}

export interface ComponentProps {
  props: ValueType;
  types: CollectedTypes;
}

export interface StoryComponent extends BaseComponent {
  kind: "story";
  args: {
    start: number;
    end: number;
    value: SerializableValue;
  } | null;
  associatedComponent: BasicFrameworkComponent | null;
}

export type BasicFrameworkComponent = Pick<
  FrameworkComponent,
  "componentId" | "extractProps"
>;
