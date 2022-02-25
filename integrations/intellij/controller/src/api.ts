export interface GetWorkspaceRequest {
  absoluteFilePath: string;
}

export interface GetWorkspaceResponse {
  workspaceId: string | null;
}

export interface DisposeWorkspaceRequest {
  workspaceId: string;
}

export interface DisposeWorkspaceResponse {}

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
  previewId: string;
  url: string;
}

export interface StopPreviewRequest {
  previewId: string;
}

export interface StopPreviewResponse {}

export interface UpdatePendingFileRequest {
  absoluteFilePath: string;
  utf8Content: string | null;
}

export interface UpdatePendingFileResponse {}
