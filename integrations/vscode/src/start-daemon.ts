import { Client, createClient } from "@previewjs/daemon/client";
import execa from "execa";
import { closeSync, openSync, readFileSync, utimesSync, watch } from "fs";
import path from "path";
import stripAnsi from "strip-ansi";
import type { OutputChannel } from "vscode";
import { clientId } from "./client-id";

const port = process.env.PREVIEWJS_PORT || "9315";
const logsPath = path.join(__dirname, "daemon.log");
const daemonLockFilePath = path.join(__dirname, "process.lock");

export async function ensureDaemonRunning(
  outputChannel: OutputChannel
): Promise<Client | null> {
  const client = createClient(`http://localhost:${port}`);
  if (!(await startDaemon(outputChannel))) {
    return null;
  }
  // Note: we expect startDaemon().process to exit 1 almost immediately when there is another
  // daemon running already (e.g. from another workspace) because of the lock file. This is
  // fine and working by design.
  const ready = streamDaemonLogs(outputChannel);
  await ready;
  await client.updateClientStatus({
    clientId,
    alive: true,
  });
  return client;
}

// Important: we wrap daemonProcess into a Promise so that awaiting startDaemon()
// doesn't automatically await the process itself (which may not exit for a long time!).
async function startDaemon(outputChannel: OutputChannel): Promise<{
  daemonProcess: execa.ExecaChildProcess<string>;
} | null> {
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
      return null;
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
    return null;
  }
  outputChannel.appendLine(
    `🚀 Starting Preview.js daemon${useWsl ? " from WSL" : ""}...`
  );
  outputChannel.appendLine(`Streaming daemon logs to: ${logsPath}`);
  const nodeDaemonCommand = "node --trace-warnings daemon.js";
  const daemonOptions: execa.Options = {
    cwd: __dirname,
    // https://nodejs.org/api/child_process.html#child_process_options_detached
    // If we use "inherit", we end up with a "write EPIPE" crash when the child process
    // tries to log after the parent process exited (even when detached properly).
    stdio: "ignore",
    env: {
      PREVIEWJS_LOCK_FILE: daemonLockFilePath,
      PREVIEWJS_LOG_FILE: logsPath,
      PREVIEWJS_PORT: port,
    },
  };
  let daemonProcess: execa.ExecaChildProcess<string>;
  if (useWsl) {
    daemonProcess = execa(
      "wsl",
      wslCommandArgs(nodeDaemonCommand, true),
      daemonOptions
    );
  } else {
    const [command, commandArgs] =
      wrapCommandWithShellIfRequired(nodeDaemonCommand);
    daemonProcess = execa(command, commandArgs, {
      ...daemonOptions,
      detached: true,
    });
  }
  daemonProcess.unref();
  return { daemonProcess };
}

function streamDaemonLogs(outputChannel: OutputChannel) {
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
    let firstRun = true;
    let waitUntilNotExiting = false;
    const onChangeListener = () => {
      try {
        const logsContent = stripAnsi(readFileSync(logsPath, "utf8"));
        if (firstRun) {
          firstRun = false;
          if (logsContent.includes("EXITING")) {
            // This is an old log file, wait until the file changes before showing anything.
            waitUntilNotExiting = true;
            return;
          }
        }
        if (waitUntilNotExiting && logsContent.includes("EXITING")) {
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
        if (!resolved && logsContent.includes("READY")) {
          resolve();
          resolved = true;
        }
      } catch (e: any) {
        // Fine, ignore. It just means log streaming is broken.
      }
    };
    watch(
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
