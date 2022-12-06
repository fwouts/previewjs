import { Client, createClient } from "@previewjs/server/client";
import execa from "execa";
import { closeSync, openSync, readFileSync, utimesSync, watch } from "fs";
import path from "path";
import stripAnsi from "strip-ansi";
import type { OutputChannel } from "vscode";
import { clientId } from "./client-id";

const port = process.env.PREVIEWJS_PORT || "9315";
const logsPath = path.join(__dirname, "server.log");
const serverLockFilePath = path.join(__dirname, "process.lock");

export async function ensureServerRunning(
  outputChannel: OutputChannel
): Promise<Client | null> {
  const client = createClient(`http://localhost:${port}`);
  await startServer(outputChannel);
  const ready = streamServerLogs(outputChannel);
  await ready;
  await client.updateClientStatus({
    clientId,
    alive: true,
  });
  return client;
}

async function startServer(outputChannel: OutputChannel): Promise<boolean> {
  const isWindows = process.platform === "win32";
  let useWsl = false;
  const nodeVersionCommand = "node --version";
  outputChannel.appendLine(`$ ${nodeVersionCommand}`);
  const [command, commandArgs] =
    wrapCommandWithShellIfRequired(nodeVersionCommand);
  const nodeVersion = await execa(command, commandArgs, {
    cwd: __dirname,
    reject: false,
  });
  if (nodeVersion.stderr) {
    // We expect to see (eval):1: can't change option: zle
    // when dealing with zsh.
    const error = nodeVersion.stderr
      .replace("(eval):1: can't change option: zle", "")
      .trim();
    if (error) {
      outputChannel.appendLine(error);
    }
  }
  if (nodeVersion.stdout) {
    outputChannel.appendLine(stripAnsi(nodeVersion.stdout));
  }
  const checkNodeVersion = checkNodeVersionResult(nodeVersion);
  if (checkNodeVersion.kind === "valid") {
    outputChannel.appendLine(`✅ Detected compatible NodeJS version`);
  }
  invalidNode: if (checkNodeVersion.kind === "invalid") {
    outputChannel.appendLine(checkNodeVersion.message);
    if (!isWindows) {
      return false;
    }
    // On Windows, try WSL as well.
    outputChannel.appendLine(`Attempting again with WSL...`);
    const wslArgs = wslCommandArgs("node --version");
    outputChannel.appendLine(
      `$ wsl ${wslArgs.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`
    );
    const nodeVersionWsl = await execa("wsl", wslArgs, {
      cwd: __dirname,
      reject: false,
    });
    const checkNodeVersionWsl = checkNodeVersionResult(nodeVersionWsl);
    if (checkNodeVersionWsl.kind === "valid") {
      outputChannel.appendLine(`✅ Detected compatible NodeJS version in WSL`);
      // The right version of Node is available through WSL. No need to crash, perfect.
      useWsl = true;
      break invalidNode;
    }
    outputChannel.appendLine(checkNodeVersionWsl.message);
    return false;
  }
  outputChannel.appendLine(
    `🚀 Starting Preview.js server${useWsl ? " from WSL" : ""}...`
  );
  outputChannel.appendLine(`Streaming server logs to: ${logsPath}`);
  const nodeServerCommand = "node --trace-warnings server.js";
  const serverOptions: execa.Options = {
    cwd: __dirname,
    stdio: "inherit",
    env: {
      PREVIEWJS_LOCK_FILE: serverLockFilePath,
      PREVIEWJS_LOG_FILE: logsPath,
      PREVIEWJS_PORT: port,
    },
  };
  let serverProcess: execa.ExecaChildProcess<string>;
  if (useWsl) {
    serverProcess = execa(
      "wsl",
      wslCommandArgs(nodeServerCommand, true),
      serverOptions
    );
  } else {
    const [command, commandArgs] =
      wrapCommandWithShellIfRequired(nodeServerCommand);
    serverProcess = execa(command, commandArgs, {
      ...serverOptions,
      detached: true,
    });
  }
  serverProcess.unref();
  return true;
}

function streamServerLogs(outputChannel: OutputChannel) {
  const ready = new Promise<void>((resolve) => {
    let lastKnownLogsLength = 0;
    let resolved = false;
    // Ensure file exists before watching.
    // Source: https://remarkablemark.org/blog/2017/12/17/touch-file-nodejs/
    try {
      const time = Date.now();
      utimesSync(logsPath, time, time);
    } catch (e) {
      let fd = openSync(logsPath, "a");
      closeSync(fd);
    }
    watch(
      logsPath,
      {
        persistent: false,
      },
      () => {
        try {
          const logsContent = stripAnsi(readFileSync(logsPath, "utf8"));
          const newLogsLength = logsContent.length;
          if (newLogsLength < lastKnownLogsLength) {
            // Log file has been rewritten.
            outputChannel.append("\n⚠️ Preview.js server was restarted ⚠️\n\n");
            lastKnownLogsLength = 0;
          }
          outputChannel.append(logsContent.slice(lastKnownLogsLength));
          lastKnownLogsLength = newLogsLength;
          // Note: " running on " also appears in "Preview.js daemon server is already running on port 9315".
          if (!resolved && logsContent.includes(" running on ")) {
            resolve();
            resolved = true;
          }
        } catch (e: any) {
          // Fine, ignore. It just means log streaming is broken.
        }
      }
    );
  });
  return ready;
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
    const withExitCode =
      result.exitCode !== 0 ? ` with exit code ${result.exitCode}` : "";
    return {
      kind: "invalid",
      message: `Preview.js needs NodeJS 14.18.0+ but running \`node\` failed${withExitCode}.\n\nIs it installed? You may need to restart your IDE.\n`,
    };
  }
  const nodeVersion = stripAnsi(result.stdout).split("\n").at(-1)!.trim();
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

function wrapCommandWithShellIfRequired(command: string) {
  const segments =
    process.platform === "win32"
      ? command.split(" ")
      : // On Linux & Mac, run inside an interactive login shell to
        // ensure NVM is set up properly.
        [
          process.env.SHELL || "bash",
          "-lic",
          // Note: We need cd ... for GitPod, which doesn't start shell in current working directory.
          `cd "${__dirname}" && ${command}`,
        ];
  return [segments[0]!, segments.slice(1)] as const;
}

function wslCommandArgs(command: string, longRunning = false) {
  return ["bash", "-lic", longRunning ? `${command} &` : command];
}