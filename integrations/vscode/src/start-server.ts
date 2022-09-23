import { Client, createClient } from "@previewjs/server/client";
import execa from "execa";
import { openSync, readFileSync } from "fs";
import path from "path";
import type { OutputChannel } from "vscode";
import { clientId } from "./client-id";
import { SERVER_PORT } from "./port";

export async function startPreviewJsServer(
  outputChannel: OutputChannel
): Promise<Client | null> {
  let useWsl = false;
  outputChannel.appendLine(`$ node --version`);
  const nodeVersion = await execa("node", ["--version"], {
    shell: process.env.SHELL || true,
    cwd: __dirname,
    reject: false,
  });
  if (nodeVersion.stderr) {
    outputChannel.appendLine(nodeVersion.stderr);
  }
  if (nodeVersion.stdout) {
    outputChannel.appendLine(nodeVersion.stdout);
  }
  const checkNodeVersion = checkNodeVersionResult(nodeVersion);
  if (checkNodeVersion.kind === "valid") {
    outputChannel.appendLine(`✅ Detected compatible NodeJS version`);
  }
  invalidNode: if (checkNodeVersion.kind === "invalid") {
    // On Windows, try WSL as well.
    if (process.platform === "win32") {
      outputChannel.appendLine(`Attempting again with WSL...`);
      const nodeVersionWsl = await execa(
        "wsl",
        wslCommandArgs("node", ["--version"]),
        {
          cwd: __dirname,
          reject: false,
        }
      );
      if (checkNodeVersionResult(nodeVersionWsl).kind === "valid") {
        outputChannel.appendLine(
          `✅ Detected compatible NodeJS version in WSL`
        );
        // The right version of Node is available through WSL. No need to crash, perfect.
        useWsl = true;
        break invalidNode;
      }
      // Show the original error.
      outputChannel.appendLine(checkNodeVersion.message);
      return null;
    }
  }
  const logsPath = path.join(__dirname, "server.log");
  const logs = openSync(logsPath, "w");
  outputChannel.appendLine(
    `🚀 Starting Preview.js server${useWsl ? " from WSL" : ""}...`
  );
  outputChannel.appendLine(`Streaming server logs to: ${logsPath}`);
  outputChannel.appendLine(
    `If you experience any issues, please include this log file in bug reports.`
  );
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
    outputChannel.appendLine(`✅ Preview.js server ready.`);
    serverProcess.unref();
  } catch (e: any) {
    if (e.stack) {
      outputChannel.appendLine(e.stack);
    }
    outputChannel.appendLine(
      `❌ Preview.js server failed to start. Please check logs above and report the issue: https://github.com/fwouts/previewjs/issues`
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

function checkNodeVersionResult(result: execa.ExecaReturnValue<string>):
  | {
      kind: "valid";
    }
  | {
      kind: "invalid";
      message: string;
    } {
  if (result.failed || result.exitCode !== 0) {
    return {
      kind: "invalid",
      message: `Preview.js needs NodeJS 14.18.0+ but running \`node\` failed.\n\nIs it installed? You may need to restart your IDE.`,
    };
  }
  const nodeVersion = result.stdout;
  const match = nodeVersion.match(/^v(\d+)\.(\d+).*$/);
  const invalidVersion = {
    kind: "invalid",
    message: `Preview.js needs NodeJS 14.18.0+ to run.\n\nPlease upgrade then restart your IDE.`,
  } as const;
  if (!match) {
    return invalidVersion;
  }
  const majorVersion = parseInt(match[1]!, 10);
  const minorVersion = parseInt(match[2]!, 10);
  // Minimum version: 14.18.0.
  if (majorVersion < 14 || (majorVersion === 14 && minorVersion < 18)) {
    return invalidVersion;
  }

  return {
    kind: "valid",
  };
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
      ...(!wsl && {
        shell: process.env.SHELL || true,
        detached: true,
      }),
    }
  );
}

function wslCommandArgs(
  command: string,
  commandArgs: string[],
  longRunning = false
) {
  return [
    "bash",
    "-lic",
    [command, ...commandArgs, ...(longRunning ? ["&"] : [])].join(" "),
  ];
}
