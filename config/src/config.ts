import type { UserConfig } from "vite";

export interface PreviewConfig {
  /** @deprecated Use the `vite.resolve.alias` field instead. */
  alias?: Record<string, string>;
  publicDir: string;
  wrapper?: {
    path: string;
    componentName?: string;
  };
  vite?: UserConfig;
}
