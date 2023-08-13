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

export interface BaseComponent {
  componentId: string;
  offsets: [start: number, end: number];
}

export interface Component extends BaseComponent {
  exported: boolean;
  extractProps: () => Promise<ComponentProps>;
}

export interface ComponentProps {
  props: ValueType;
  types: CollectedTypes;
}

export interface Story extends BaseComponent {
  args: {
    start: number;
    end: number;
    value: SerializableValue;
  } | null;
  associatedComponent: BasicComponent | null;
}

export type BasicComponent = Pick<Component, "componentId" | "extractProps">;
