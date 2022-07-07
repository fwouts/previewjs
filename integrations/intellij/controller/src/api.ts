export interface GetWorkspaceRequest {
  absoluteFilePath: string;
}

export interface GetWorkspaceResponse {
  workspaceId: string | null;
}

export interface DisposeWorkspaceRequest {
  workspaceId: string;
}

export type DisposeWorkspaceResponse = Record<string, never>;

export interface AnalyzeFileRequest {
  workspaceId: string;
  absoluteFilePath: string;
  options?: {
    offset?: number;
  };
}

export interface AnalyzeFileResponse {
  components: Array<{
    componentName: string;
    offset: number;
    componentId: string;
  }>;
}

export interface StartPreviewRequest {
  workspaceId: string;
}

export interface StartPreviewResponse {
  url: string;
}

export interface StopPreviewRequest {
  workspaceId: string;
}

export type StopPreviewResponse = Record<string, never>;

export interface UpdatePendingFileRequest {
  absoluteFilePath: string;
  utf8Content: string | null;
}

export type UpdatePendingFileResponse = Record<string, never>;
