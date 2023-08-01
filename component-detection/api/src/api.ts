import type { SerializableValue } from "@previewjs/serializable-values";
import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import type { Logger } from "pino";

export type ComponentDetector = {
  typeAnalyzer: Omit<TypeAnalyzer, "dispose">;
  detectComponents: (filePaths: string[]) => Promise<Component[]>;
  dispose: () => void;
};

export type ComponentDetectorFactory = (options?: {
  rootDir?: string;
  reader?: Reader;
  logger?: Logger;
}) => ComponentDetector;

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
