import type { SerializableValue } from "@previewjs/serializable-values";
import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import type { Logger } from "pino";

export type Analyzer = {
  typeAnalyzer: Omit<TypeAnalyzer, "dispose">;
  crawlFile: (filePaths: string[]) => Promise<{
    components: Component[];
    stories: Story[];
  }>;
  dispose: () => void;
};

export type AnalyzerFactory = (options: {
  rootDir: string;
  reader?: Reader;
  logger?: Logger;
}) => Analyzer;

export interface BasePreviewable {
  id: string;
  sourcePosition: FileSourcePosition;
}

export interface Component extends BasePreviewable {
  exported: boolean;
  analyze: () => Promise<ComponentAnalysis>;
}

export interface ComponentAnalysis {
  props: ValueType;
  types: CollectedTypes;
}

export interface Story extends BasePreviewable {
  analyze: () => Promise<StoryArgs | null>;
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

export type BasicComponent = Pick<Component, "id" | "analyze">;
