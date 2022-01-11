export interface GetWorkspaceRequest {
  filePath: string;
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
  filePath: string;
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
  filePath: string;
  utf8Content: string | null;
}

export interface UpdatePendingFileResponse {}
