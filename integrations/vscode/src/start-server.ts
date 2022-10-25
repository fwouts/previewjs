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
    outputChannel.appendLine(ignoreBellPrefix(nodeVersion.stdout));
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
  const logsPath = path.join(__dirname, "server.log");
  const logs = openSync(logsPath, "w");
  outputChannel.appendLine(
    `🚀 Starting Preview.js server${useWsl ? " from WSL" : ""}...`
  );
  outputChannel.appendLine(`Streaming server logs to: ${logsPath}`);
  outputChannel.appendLine(
    `If you experience any issues, please include this log file in bug reports.`
  );
  const nodeServerCommand = "node server.js";
  const serverOptions = {
    cwd: __dirname,
    stdio: ["ignore", logs, logs],
  } as const;
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
    const withExitCode =
      result.exitCode !== 0 ? ` with exit code ${result.exitCode}` : "";
    return {
      kind: "invalid",
      message: `Preview.js needs NodeJS 14.18.0+ but running \`node\` failed${withExitCode}.\n\nIs it installed? You may need to restart your IDE.\n`,
    };
  }
  const nodeVersion = ignoreBellPrefix(result.stdout)
    .split("\n")
    .at(-1)!
    .trim();
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

function ignoreBellPrefix(stdout: string) {
  // Important: because we use an interactive login shell, the stream may contain some other logging caused by
  // sourcing scripts. For example:
  // ]697;DoneSourcing]697;DoneSourcingmissing
  // We ignore anything before the last BEL character (07).
  return stdout.split("\u0007").at(-1)!;
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
