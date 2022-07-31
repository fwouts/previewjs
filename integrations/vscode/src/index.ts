import { install, isInstalled } from "@previewjs/loader";
import { runServer } from "@previewjs/server";
import { createClient } from "@previewjs/server/client";
import { readFileSync } from "fs";
import path from "path";
import vscode, { OutputChannel } from "vscode";
import { closePreviewPanel, updatePreviewPanel } from "./preview-panel";
import { ensurePreviewServerStarted } from "./preview-server";
import { openUsageOnFirstTimeStart } from "./welcome";

const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

const codeLensLanguages = [
  "javascript",
  "javascriptreact",
  "jsx",
  "typescriptreact",
  "vue",
];

const watchedExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".vue",
  ".css",
  ".sass",
  ".scss",
  ".less",
  ".styl",
  ".stylus",
  ".svg",
]);

let dispose = async () => {
  // Do nothing.
};

async function initializePreviewJs(outputChannel: OutputChannel) {
  const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }

  let requirePath = process.env.PREVIEWJS_MODULES_DIR;
  if (!requirePath) {
    requirePath = path.join(__dirname, "..", "dependencies");
    if (!(await isInstalled({ installDir: requirePath, packageName }))) {
      outputChannel.show();
      await install({
        installDir: requirePath,
        packageName,
        onOutput: (chunk) => {
          outputChannel.append(chunk);
        },
      });
    }
  }

  // TODO: Dynamic? Same as IntelliJ? Figure it out.
  const port = 9200;

  // TODO: Only start server once across all workspaces.
  // TODO: Dispose of server when no longer needed.
  // TODO: Start this in a separate Node process, that's the whole point!
  console.error("Starting server");
  const _disposeServer = await runServer({
    loaderInstallDir: requirePath,
    packageName,
    versionCode: `vscode-${version}`,
    port,
  });
  console.error("Started server");
  // TODO: Should it always be localhost?
  return createClient(`http://localhost:${port}`);
}

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration();
  const outputChannel = vscode.window.createOutputChannel("Preview.js");
  let previewjsClientInitialized: Awaited<
    ReturnType<typeof initializePreviewJs>
  > | null = null;
  let initializationFailed = false;
  let focusedOutputChannelForError = false;
  const previewjsInitPromise = initializePreviewJs(outputChannel)
    .then((p) => (previewjsClientInitialized = p))
    .catch((e) => {
      console.error(e);
      initializationFailed = true;
      return null;
    });

  async function getWorkspaceId(absoluteFilePath: string) {
    const previewjsClient = await previewjsInitPromise;
    if (!previewjsClient) {
      return null;
    }
    const workspace = previewjsClient.getWorkspace({
      absoluteFilePath,
    });
    return (await workspace).workspaceId;
  }

  // Note: ESlint warning isn't relevant because we're correctly inferring arguments types.
  // eslint-disable-next-line @typescript-eslint/ban-types
  function catchErrors<F extends Function>(f: F) {
    return async (...args: F extends (...args: infer A) => any ? A : never) => {
      try {
        return await f(...args);
      } catch (e: unknown) {
        if (!focusedOutputChannelForError) {
          outputChannel.show();
          focusedOutputChannelForError = true;
        }
        outputChannel.appendLine(
          e instanceof Error ? e.stack || e.message : `${e}`
        );
        throw e;
      }
    };
  }

  dispose = async () => {
    outputChannel.dispose();
    // TODO: Dispose again!
    // await (await previewjsInitPromise)?.dispose();
  };

  await openUsageOnFirstTimeStart(context);

  if (config.get("previewjs.codelens", true)) {
    vscode.languages.registerCodeLensProvider(codeLensLanguages, {
      provideCodeLenses: catchErrors(async (document: vscode.TextDocument) => {
        const workspaceId = await getWorkspaceId(document.fileName);
        if (!workspaceId || !previewjsClientInitialized) {
          return [];
        }
        const previewjsClient = previewjsClientInitialized;
        const { components } = await previewjsClient.analyzeFile({
          workspaceId,
          absoluteFilePath: document.fileName,
        });
        return components.map((c) => {
          const start = document.positionAt(c.offset + 2);
          const lens = new vscode.CodeLens(new vscode.Range(start, start));
          lens.command = {
            command: "previewjs.open",
            arguments: [document, c.componentId],
            title: `Open ${c.componentName} in Preview.js`,
          };
          return lens;
        });
      }),
    });
  }

  if (config.get("previewjs.livePreview", true)) {
    vscode.workspace.onDidChangeTextDocument((e) => {
      updateDocument(e.document);
    });
    vscode.workspace.onDidSaveTextDocument((e) => {
      updateDocument(e, true);
    });
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (!e) {
        // Do nothing.
        return;
      }
      updateDocument(e.document);
    });
    function updateDocument(document: vscode.TextDocument, saved = false) {
      if (
        !previewjsClientInitialized ||
        !path.isAbsolute(document.fileName) ||
        !watchedExtensions.has(path.extname(document.fileName))
      ) {
        return;
      }
      previewjsClientInitialized.updatePendingFile({
        absoluteFilePath: document.fileName,
        utf8Content: saved ? null : document.getText(),
      });
    }
  }

  vscode.commands.registerCommand(
    "previewjs.open",
    catchErrors(
      async (document?: vscode.TextDocument, componentId?: string) => {
        if (!previewjsClientInitialized) {
          vscode.window.showErrorMessage(
            initializationFailed
              ? "Preview.js was unable to start successfully. Please check Preview.js output panel or file a bug at https://github.com/fwouts/previewjs/issues."
              : "Preview.js is not ready yet. Please check Preview.js output panel or file a bug at https://github.com/fwouts/previewjs/issues."
          );
          return;
        }
        const previewjsClient = previewjsClientInitialized;
        if (typeof componentId !== "string") {
          // If invoked from clicking the button, the value may be { groupId: 0 }.
          componentId = undefined;
        }
        const editor = vscode.window.activeTextEditor;
        if (!document?.fileName) {
          document = editor?.document;
        }
        if (!document?.fileName) {
          return;
        }
        const workspaceId = await getWorkspaceId(document.fileName);
        if (!workspaceId) {
          return;
        }
        if (componentId === undefined) {
          if (!editor) {
            return;
          }
          const offset = document.offsetAt(editor.selection.active);
          const { components } = await previewjsClient.analyzeFile({
            workspaceId,
            absoluteFilePath: document.fileName,
            options: {
              offset,
            },
          });
          const component = components[0];
          if (!component) {
            vscode.window.showErrorMessage(
              `No component was found at offset ${offset}`
            );
            return;
          }
          componentId = component.componentId;
        }
        const preview = await ensurePreviewServerStarted(
          previewjsClient,
          workspaceId
        );
        updatePreviewPanel(previewjsClient, preview.url, componentId);
      }
    )
  );
}

export async function deactivate() {
  await closePreviewPanel();
  // TODO: Remove?
  // await ensurePreviewServerStopped();
  await dispose();
  dispose = async () => {
    // Do nothing.
  };
}
