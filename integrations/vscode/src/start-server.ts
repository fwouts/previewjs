import { createClient } from "@previewjs/server/client";
import execa from "execa";
import { openSync, readFileSync } from "fs";
import path from "path";
import type { OutputChannel } from "vscode";
import { clientId } from "./client-id";
import { SERVER_PORT } from "./port";

export async function startPreviewJsServer(outputChannel: OutputChannel) {
  const nodeVersion = await execa("node", ["--version"], {
    cwd: __dirname,
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
        cwd: __dirname,
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
  const logsPath = path.join(__dirname, "server.log");
  const logs = openSync(logsPath, "w");
  outputChannel.appendLine(`Starting Preview.js server...`);
  if (useWsl) {
    outputChannel.appendLine(`Using NodeJS from WSL.`);
  }
  outputChannel.appendLine(`Streaming logs to: ${logsPath}`);
  const serverProcess = execLongRunningCommand("node", ["server.js"], {
    cwd: __dirname,
    wsl: useWsl,
    stdio: ["ignore", logs, logs],
  });

  const client = createClient(`http://localhost:${SERVER_PORT}`);
  try {
    const startTime = Date.now();
    const timeoutMillis = 30000;
    loop: while (true) {
      try {
        await client.info();
        break loop;
      } catch (e) {
        if (serverProcess.exitCode) {
          // Important: an exit code of 0 may be correct, especially if:
          // 1. Another server is already running.
          // 2. WSL is used, so the process exits immediately because it spans another one.
          outputChannel.append(readFileSync(logsPath, "utf8"));
          throw new Error(
            `Preview.js server exited with code ${serverProcess.exitCode}`
          );
        }
        if (Date.now() - startTime > timeoutMillis) {
          throw new Error(
            `Connection timed out after ${timeoutMillis}ms: ${e}`
          );
        }
        // Ignore the error and retry after a short delay.
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }
    client.info();
    await client.waitForReady();
    outputChannel.appendLine(`Preview.js server ready.`);
    serverProcess.unref();
  } catch (e) {
    outputChannel.appendLine(
      `Preview.js server failed to start. Please check logs above and report the issue: https://github.com/fwouts/previewjs/issues`
    );
    await serverProcess;
    throw e;
  }
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
      ...(!wsl && { detached: true }),
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
