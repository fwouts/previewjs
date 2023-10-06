import type { UserConfig } from "vite";

export function defineConfig(config: PreviewConfig) {
  return {
    // Note: this can be removed after Feb 2024.
    publicDir: "public",
    ...config,
  };
}

export interface PreviewConfig {
  /** @deprecated Use the `vite.resolve.alias` field instead. */
  alias?: Record<string, string>;
  publicDir?: string;
  wrapper?: {
    path: string;
    componentName?: string;
  };
  vite?: UserConfig;
}
