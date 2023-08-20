import type { OnServerStart } from "@previewjs/core";
import express from "express";
import path from "path";
import url from "url";

const onServerStart: OnServerStart = async () => {
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  return {
    middlewares: [express.static(path.join(__dirname, "..", "client", "dist"))],
  };
};

export default onServerStart;
