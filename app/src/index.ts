import type { SetupPreviewEnvironment } from "@previewjs/core";
import express from "express";
import fs from "fs";
import path from "path";

const setup: SetupPreviewEnvironment = async () => {
  return {
    middlewares: [express.static(findClientDir(__dirname))],
  };
};

function findClientDir(dirPath: string): string {
  const potentialPath = path.join(dirPath, "client", "dist");
  if (fs.existsSync(potentialPath)) {
    return potentialPath;
  } else {
    const parentPath = path.dirname(dirPath);
    if (!parentPath || parentPath === dirPath) {
      throw new Error(`Unable to find compiled client directory (client/dist)`);
    }
    return findClientDir(parentPath);
  }
}

export default setup;
