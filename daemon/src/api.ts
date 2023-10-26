export type KillRequest = Record<never, never>;

export type KillResponse = {
  pid: number;
};

export type CrawlFileRequest = {
  absoluteFilePath: string;
};

export type CrawlFileResponse =
  | { rootDir: null; previewables: never[] }
  | {
      rootDir: string;
      previewables: Array<{
        start: number;
        end: number;
        id: string;
      }>;
    };

export type StartPreviewRequest = {
  rootDir: string;
};

export type StartPreviewResponse = {
  rootDir: string;
  url: string;
};

export type CheckPreviewStatusRequest = {
  rootDir: string;
};

export type CheckPreviewStatusResponse = {
  running: boolean;
};

export type StopPreviewRequest = {
  rootDir: string;
};

export type StopPreviewResponse = Record<never, never>;

export type UpdatePendingFileRequest = {
  absoluteFilePath: string;
  utf8Content: string | null;
};

export type UpdatePendingFileResponse = Record<never, never>;
