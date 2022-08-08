import { checkNodeVersion, execCommand } from "@previewjs/loader";
import { createClient } from "@previewjs/server/client";
import { openSync } from "fs";
import path from "path";
import type { OutputChannel } from "vscode";
import { clientId } from "./client-id";
import { installDependenciesIfNeeded } from "./install-dependencies";
import { SERVER_PORT } from "./port";

export async function startPreviewJsServer(outputChannel: OutputChannel) {
  const { wsl } = await checkNodeVersion(__dirname);
  await installDependenciesIfNeeded(outputChannel);

  const out = openSync(path.join(__dirname, "server-out.log"), "a");
  const err = openSync(path.join(__dirname, "server-err.log"), "a");
  const serverProcess = execCommand("./server.js", [], {
    all: true,
    detached: true,
    stdio: ["ignore", out, err /* "ipc" */],
    cwd: __dirname,
    env: {
      ...process.env,
    },
    wsl,
  });

  const client = createClient(`http://localhost:${SERVER_PORT}`);
  // TODO: This doesn't handle failure!
  outputChannel.appendLine("Waiting for Preview.js server to start...");
  await client.waitForReady();
  outputChannel.appendLine("Preview.js server started!");
  // await new Promise<void>((resolve, reject) => {
  //   const readyListener = (chunk: string) => {
  //     if (chunk === JSON.stringify({ type: "ready" })) {
  //       resolve();
  //       serverProcess.disconnect();
  //       serverProcess.unref();
  //     }
  //   };
  //   serverProcess.on("message", readyListener);
  //   serverProcess.catch((e) => {
  //     console.error("Error starting server", e);
  //     reject(e);
  //   });
  // });
  await client.updateClientStatus({
    clientId,
    alive: true,
  });
  return client;
}
