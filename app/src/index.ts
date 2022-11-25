import type { SetupPreviewEnvironment } from "@previewjs/core";
import express from "express";
import path from "path";

const setup: SetupPreviewEnvironment = async () => {
  return {
    middlewares: [express.static(path.join(__dirname, "..", "client", "dist"))],
  };
};

export default setup;
