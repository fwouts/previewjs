import { createClient } from "@previewjs/server/client";
import execa from "execa";
import { openSync } from "fs";
import path from "path";
import { clientId } from "./client-id";
import { SERVER_PORT } from "./port";

export async function startPreviewJsServer() {
  const out = openSync(path.join(__dirname, "server-out.log"), "a");
  const err = openSync(path.join(__dirname, "server-err.log"), "a");
  const nodeVersion = await execa("node", ["--version"], {
    reject: false,
  });
  let useWsl = false;
  try {
    await checkNodeVersionResult(nodeVersion);
  } catch (e) {
    if (process.platform !== "win32") {
      throw e;
    }
    const nodeVersionWsl = await execa(
      "wsl",
      wslCommandArgs("node", ["--version"]),
      {
        reject: false,
      }
    );
    try {
      await checkNodeVersionResult(nodeVersionWsl);
      useWsl = true;
    } catch {
      // Throw the original error.
      throw e;
    }
  }
  const serverProcess = execLongRunningCommand(
    "node",
    [`${__dirname}/server.js`],
    {
      wsl: useWsl,
      all: true,
      stdio: ["ignore", out, err, "ipc"],
    }
  );

  const client = createClient(`http://localhost:${SERVER_PORT}`);
  await new Promise<void>((resolve, reject) => {
    const readyListener = (chunk: string) => {
      if (chunk === JSON.stringify({ type: "ready" })) {
        resolve();
        serverProcess.disconnect();
        serverProcess.unref();
      }
    };
    serverProcess.on("message", readyListener);
    serverProcess.catch((e) => {
      console.error("Error starting server", e);
      reject(e);
    });
  });
  await client.updateClientStatus({
    clientId,
    alive: true,
  });
  return client;
}

function checkNodeVersionResult(result: execa.ExecaReturnValue<string>) {
  if (result.failed) {
    throw new Error(
      `Preview.js was unable to run node.\n\nIs it installed? You may need to restart your IDE.`
    );
  }
  if (result.exitCode !== 0) {
    throw new Error(
      `Preview.js was unable to run node (exit code ${result.exitCode}):\n\n${result.stderr}`
    );
  }
  const nodeVersion = result.stdout;
  if (parseInt(nodeVersion) < 14) {
    throw new Error(
      `Preview.js needs NodeJS 14+ to run, but current version is: ${nodeVersion}\n\nPlease upgrade then restart your IDE.`
    );
  }
}

function execLongRunningCommand(
  command: string,
  commandArgs: string[],
  { wsl, ...options }: execa.Options & { wsl: boolean }
) {
  return execa(
    wsl ? "wsl" : command,
    wsl ? wslCommandArgs(command, commandArgs, true) : commandArgs,
    {
      ...options,
    }
  );
}

function wslCommandArgs(
  command: string,
  commandArgs: string[],
  longRunning = false
) {
  return [
    ...(longRunning ? ["nohup"] : []),
    "bash",
    "-lic",
    [command, ...commandArgs, ...(longRunning ? ["&"] : [])].join(" "),
  ];
}
