import type {
  PreviewEnvironment,
  SetupPreviewEnvironment,
} from "@previewjs/core";
import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { vue2FrameworkPlugin } from "@previewjs/plugin-vue2";
import { vue3FrameworkPlugin } from "@previewjs/plugin-vue3";
import express from "express";
import path from "path";

const setup: SetupPreviewEnvironment =
  async (): Promise<PreviewEnvironment | null> => {
    return {
      frameworkPluginFactories: [
        reactFrameworkPlugin,
        vue2FrameworkPlugin,
        vue3FrameworkPlugin,
      ],
      middlewares: [express.static(path.join(__dirname, "../client/dist"))],
    };
  };

export default setup;
