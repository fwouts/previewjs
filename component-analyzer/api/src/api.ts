import type { SerializableValue } from "@previewjs/serializable-values";
import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import type { Logger } from "pino";

export type ComponentAnalyzer = {
  typeAnalyzer: Omit<TypeAnalyzer, "dispose">;
  detectComponents: (filePaths: string[]) => Promise<{
    components: Component[];
    stories: Story[];
  }>;
  dispose: () => void;
};

export type ComponentAnalyzerFactory = (options: {
  rootDir: string;
  reader?: Reader;
  logger?: Logger;
}) => ComponentAnalyzer;

export interface BasePreviewable {
  previewableId: string;
  sourcePosition: FileSourcePosition;
}

export interface Component extends BasePreviewable {
  exported: boolean;
  extractProps: () => Promise<ComponentProps>;
}

export interface ComponentProps {
  props: ValueType;
  types: CollectedTypes;
}

export interface Story extends BasePreviewable {
  extractArgs: () => Promise<StoryArgs | null>;
  associatedComponent: BasicComponent | null;
}

export type StoryArgs = {
  sourcePosition: FileSourcePosition;
  value: SerializableValue;
};

export type FileSourcePosition = {
  start: number;
  end: number;
};

export type BasicComponent = Pick<Component, "previewableId" | "extractProps">;
