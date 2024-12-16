import type { Client } from "@previewjs/daemon/client";
import { createClient } from "@previewjs/daemon/client";
import type { ExecaChildProcess, ExecaReturnValue, Options } from "execa";
import { execa } from "execa";
import type { FSWatcher } from "fs";
import { closeSync, openSync, readFileSync, utimesSync, watch } from "fs";
import getPort from "get-port";
import path from "path";
import stripAnsi from "strip-ansi";
import type { OutputChannel } from "vscode";
import vscode from "vscode";

export async function startDaemon(outputChannel: OutputChannel): Promise<{
  client: Client;
  watcher: FSWatcher;
  daemonProcess: ExecaChildProcess;
} | null> {
  const port = await getPort();
  const now = new Date();
  const logsPath = path.join(
    __dirname,
    `daemon-${now.getFullYear()}${padTwoDigits(
      now.getMonth() + 1
    )}${padTwoDigits(now.getDate())}${padTwoDigits(
      now.getHours()
    )}${padTwoDigits(now.getMinutes())}-${port}.log`
  );
  const client = createClient(`http://localhost:${port}`);
  const daemon = await startDaemonProcess(port, logsPath, outputChannel);
  if (!daemon) {
    return null;
  }
  // Note: we expect startDaemon().process to exit 1 almost immediately when there is another
  // daemon running already (e.g. from another workspace) because of the lock file. This is
  // fine and working by design.
  const ready = streamDaemonLogs(logsPath, outputChannel);
  const watcher = await ready;
  return {
    client,
    watcher,
    daemonProcess: daemon.daemonProcess,
  };
}

function padTwoDigits(value: number) {
  return value.toString(10).padStart(2, "0");
}

// Important: we wrap daemonProcess into a Promise so that awaiting startDaemon()
// doesn't automatically await the process itself (which may not exit for a long time!).
async function startDaemonProcess(
  port: number,
  logsPath: string,
  outputChannel: OutputChannel
): Promise<{
  daemonProcess: ExecaChildProcess<string>;
} | null> {
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
  if (checkNodeVersion.kind === "invalid") {
    outputChannel.appendLine(checkNodeVersion.message);
    return null;
  }
  outputChannel.appendLine(`🚀 Starting Preview.js daemon...`);
  outputChannel.appendLine(`Streaming daemon logs to: ${logsPath}`);
  const nodeDaemonCommand = "node --trace-warnings daemon.js";
  const daemonOptions: Options = {
    cwd: __dirname,
    env: {
      PREVIEWJS_LOG_FILE: logsPath,
      PREVIEWJS_PORT: port.toString(10),
      PREVIEWJS_PARENT_PROCESS_PID: process.pid.toString(10),
    },
  };
  const [daemonCommand, daemonCommandArgs] =
    wrapCommandWithShellIfRequired(nodeDaemonCommand);
  const daemonProcess = execa(daemonCommand, daemonCommandArgs, daemonOptions);
  daemonProcess.on("error", (error) => {
    outputChannel.append(`${error}`);
  });
  return { daemonProcess };
}

function streamDaemonLogs(
  logsPath: string,
  outputChannel: OutputChannel
): Promise<FSWatcher> {
  const ready = new Promise<FSWatcher>((resolve) => {
    let lastKnownLogsLength = 0;
    let resolved = false;
    // Ensure file exists before watching.
    // Source: https://remarkablemark.org/blog/2017/12/17/touch-file-nodejs/
    try {
      const time = Date.now();
      utimesSync(logsPath, time, time);
    } catch {
      let fd = openSync(logsPath, "a");
      closeSync(fd);
    }
    let firstRun = true;
    let waitUntilNotExiting = false;
    let resolveInstall: (() => void) | null = null;
    const onChangeListener = () => {
      try {
        const logsContent = stripAnsi(readFileSync(logsPath, "utf8"));
        if (firstRun) {
          firstRun = false;
          if (logsContent.includes("[exit]")) {
            // This is an old log file, wait until the file changes before showing anything.
            waitUntilNotExiting = true;
            return;
          }
        }
        if (waitUntilNotExiting && logsContent.includes("[exit]")) {
          return;
        }
        waitUntilNotExiting = false;
        const newLogsLength = logsContent.length;
        if (newLogsLength < lastKnownLogsLength) {
          // Log file has been rewritten.
          outputChannel.append("\n⚠️ Preview.js daemon was restarted ⚠️\n\n");
          lastKnownLogsLength = 0;
        }
        outputChannel.append(logsContent.slice(lastKnownLogsLength));
        lastKnownLogsLength = newLogsLength;
        if (logsContent.includes("[install:end]")) {
          if (resolveInstall) {
            resolveInstall();
            resolveInstall = null;
          }
        } else if (logsContent.includes("[install:begin]") && !resolveInstall) {
          const installPromise = new Promise<void>((resolve) => {
            resolveInstall = resolve;
          });
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              cancellable: false,
              title: "⏳ Installing Preview.js dependencies...",
            },
            async (progress) => {
              progress.report({ increment: 0 });
              await installPromise;
              progress.report({ increment: 100 });
              vscode.window.showInformationMessage(
                "✅ Preview.js dependencies installed"
              );
            }
          );
        }
        if (!resolved && logsContent.includes("[ready]")) {
          resolve(watcher);
          resolved = true;
        }
      } catch {
        // Fine, ignore. It just means log streaming is broken.
      }
    };
    const watcher = watch(
      logsPath,
      {
        persistent: false,
      },
      onChangeListener
    );
    // Make sure to read the logs immediately!
    onChangeListener();
  });
  return ready;
}

function checkNodeVersionResult(result: ExecaReturnValue<string>):
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
      message: `Preview.js needs NodeJS 18+ but running \`node\` failed${withExitCode}.\n\nIs it installed? You may need to restart your IDE.\n`,
    };
  }
  const nodeVersion = stripAnsi(result.stdout).split("\n").at(-1)!.trim();
  const match = nodeVersion.match(/^v(\d+)\.(\d+).*$/);
  const invalidVersion = {
    kind: "invalid",
    message: `Preview.js needs NodeJS 18+ to run.\n\nPlease upgrade then restart your IDE.`,
  } as const;
  if (!match) {
    return invalidVersion;
  }
  const majorVersion = parseInt(match[1]!, 10);
  if (majorVersion < 18) {
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
