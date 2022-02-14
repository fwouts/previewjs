import { LocalApi } from "@previewjs/app/client/src/api/local";
import { AnalyzeProjectEndpoint } from "@previewjs/pro-api/endpoints";
import { autorun, makeAutoObservable, runInAction } from "mobx";

export class SidePanelState {
  toggled = false;
  loading = false;
  error: string | null = null;
  directory: Directory | null = null;

  constructor(
    private readonly localApi: LocalApi,
    private readonly getCurrentRelativeFilePath: () => string | null,
    private readonly onRelativeFilePathSelected: (file: File) => void
  ) {
    makeAutoObservable(this);

    autorun(() => {
      this.ensureExpanded();
    });
  }

  get currentRelativeFilePath() {
    return this.getCurrentRelativeFilePath();
  }

  onSelect(file: File) {
    this.onRelativeFilePathSelected(file);
  }

  private ensureExpanded() {
    const relativeFilePath = this.getCurrentRelativeFilePath();
    if (!relativeFilePath) {
      return;
    }
    const segments = relativeFilePath.split(/[/\\]/g);
    runInAction(() => {
      if (!this.directory) {
        return;
      }
      let directory = this.directory;
      for (let i = 0; i < segments.length; i++) {
        directory.expanded = true;
        const child = directory.entries[segments[i]!];
        if (child?.kind === "dir") {
          directory = child;
        } else {
          break;
        }
      }
    });
  }

  toggle() {
    this.toggled = !this.toggled;
    if (this.toggled && !this.directory) {
      this.refresh();
    }
  }

  refresh(forceRefresh = false) {
    this.directory = null;
    this.error = null;
    this.loading = true;
    this.analyzeProject(forceRefresh)
      .then((directory) => {
        runInAction(() => {
          this.error = null;
          this.directory = directory;
        });
      })
      .catch((e) => {
        console.error(e);
        runInAction(() => {
          this.error = e.message;
        });
      })
      .then(() => {
        runInAction(() => {
          this.loading = false;
          this.ensureExpanded();
        });
      });
  }

  toggleDirectory(dir: Directory) {
    dir.expanded = !dir.expanded;
  }

  private async analyzeProject(forceRefresh: boolean) {
    const analyzeProjectResponse = await this.localApi.request(
      AnalyzeProjectEndpoint,
      {
        forceRefresh,
      }
    );
    const directory: Directory = {
      kind: "dir",
      entries: {},
      totalCount: 0,
      expanded: true,
      dirPath: "",
    };
    for (const [filePath, fileComponents] of Object.entries(
      analyzeProjectResponse.components
    )) {
      const segments = filePath.split(/[/\\]/g);
      this.recordEntry(directory, segments, fileComponents, segments);
    }
    return directory;
  }

  private recordEntry(
    directory: Directory,
    segments: string[],
    fileComponents: ComponentInfo[],
    allSegments: string[]
  ) {
    directory.totalCount += fileComponents.filter((c) => c.exported).length;
    const [root, ...rest] = segments;
    if (!root) {
      return;
    }
    if (rest.length === 0) {
      directory.entries[root] = {
        kind: "file",
        relativeFilePath: allSegments.join("/"),
        components: fileComponents,
      };
    } else {
      if (!directory.entries[root]) {
        directory.entries[root] = {
          kind: "dir",
          entries: {},
          totalCount: 0,
          expanded: false,
          dirPath: allSegments
            .slice(0, 1 + allSegments.length - segments.length)
            .join("/"),
        };
      }
      const dir = directory.entries[root];
      if (dir?.kind !== "dir") {
        return;
      }
      this.recordEntry(dir, rest, fileComponents, allSegments);
    }
  }
}

export interface Directory {
  kind: "dir";
  entries: {
    [name: string]: File | Directory;
  };
  dirPath: string;
  expanded: boolean;
  totalCount: number;
}

export interface File {
  kind: "file";
  relativeFilePath: string;
  components: ComponentInfo[];
}

export interface ComponentInfo {
  componentName: string;
  exported: boolean;
}
