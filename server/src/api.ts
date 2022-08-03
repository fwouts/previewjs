export type InfoRequest = Record<never, never>;

export interface InfoResponse {
  loaderInstallDir: string;
  packageName: string;
  versionCode: string;
}

export type KillRequest = Record<never, never>;

export type KillResponse = Record<never, never>;

export interface UpdateClientStatusRequest {
  clientId: string;
  alive: boolean;
}

export type UpdateClientStatusResponse = Record<never, never>;

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
