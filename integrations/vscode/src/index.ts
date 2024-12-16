import path from "path";
import vscode from "vscode";
import { closePreviewPanel, updatePreviewPanel } from "./preview-panel.js";
import {
  ensurePreviewServerStarted,
  ensurePreviewServerStopped,
  isPreviewServerRunning,
} from "./preview-server.js";
import { createState } from "./state.js";

// Note: all commands in package.json must appear here. The reverse is not true.
enum Command {
  START = "previewjs.start",
  STOP = "previewjs.stop",
  RESET = "previewjs.reset",
  OPEN_MENU = "previewjs.open-menu",
  OPEN_IN_EXTERNAL_BROWSER = "previewjs.open-in-external-browser",
}

const codeLensLanguages = [
  "javascript",
  "javascriptreact",
  "jsx",
  "svelte",
  "typescript",
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
  ".svelte",
  ".svg",
]);

let dispose = async () => {
  // Do nothing.
};

export async function activate({ subscriptions }: vscode.ExtensionContext) {
  const runningServerStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  subscriptions.push(runningServerStatusBarItem);
  runningServerStatusBarItem.command = Command.OPEN_MENU;

  const onDispose = () => {
    runningServerStatusBarItem.hide();
  };

  const outputChannel = vscode.window.createOutputChannel("Preview.js");
  subscriptions.push(outputChannel);
  let currentState = createState({
    outputChannel,
    runningServerStatusBarItem,
    onDispose,
  });

  const config = vscode.workspace.getConfiguration();

  let focusedOutputChannelForError = false;
  function onError(e: unknown) {
    if (!focusedOutputChannelForError) {
      outputChannel.show();
      focusedOutputChannelForError = true;
    }
    outputChannel.appendLine(
      e instanceof Error ? e.stack || e.message : `${e}`
    );
  }

  // Note: ESlint warning isn't relevant because we're correctly inferring arguments types.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  function catchErrors<F extends Function>(f: F) {
    return async (...args: F extends (...args: infer A) => any ? A : never) => {
      try {
        return await f(...args);
      } catch (e: unknown) {
        onError(e);
        throw e;
      }
    };
  }

  dispose = async () => {
    const state = await currentState;
    if (state) {
      if (state.currentPreview) {
        await state.client.stopPreview({
          rootDir: state.currentPreview.rootDir,
        });
      }
      await closePreviewPanel(state);
      currentState = Promise.resolve(null);
    }
  };

  vscode.window.onDidChangeActiveTextEditor(async (e) => {
    const state = await currentState;
    if (!state) {
      return;
    }
    const crawlFileResponse = await state.crawlFile(e?.document);
    vscode.commands.executeCommand(
      "setContext",
      "previewjs.previewablesDetected",
      crawlFileResponse.previewables.length > 0
    );
  });

  if (config.get("previewjs.codelens", true)) {
    vscode.languages.registerCodeLensProvider(codeLensLanguages, {
      provideCodeLenses: catchErrors(async (document: vscode.TextDocument) => {
        const state = await currentState;
        if (!state) {
          return;
        }
        const crawlFileResponse = await state.crawlFile(document);
        return crawlFileResponse.previewables.map((c) => {
          const start = document.positionAt(c.start + 2);
          const lens = new vscode.CodeLens(new vscode.Range(start, start));
          const previewableName = c.id.substring(c.id.indexOf(":") + 1);
          lens.command = {
            command: Command.START,
            arguments: [document, c.id],
            title: `Open ${previewableName} in Preview.js`,
          };
          return lens;
        });
      }),
    });
  }

  vscode.workspace.onDidChangeTextDocument(async (e) => {
    await updateDocument(e.document);
  });
  vscode.workspace.onDidSaveTextDocument(async (e) => {
    await updateDocument(e, true);
  });
  async function updateDocument(document: vscode.TextDocument, saved = false) {
    const state = await currentState;
    if (
      !state ||
      !path.isAbsolute(document.fileName) ||
      !watchedExtensions.has(path.extname(document.fileName))
    ) {
      return;
    }
    if (state.previewPanel?.visible) {
      await state.client.updatePendingFile({
        absoluteFilePath: document.fileName,
        utf8Content: saved ? null : document.getText(),
      });
    } else {
      // Don't make unnecessary HTTP requests to Preview.js API, keep them for
      // when the preview panel is active.
      if (saved) {
        state.pendingFileChanges.delete(document.fileName);
      } else {
        state.pendingFileChanges.set(document.fileName, document.getText());
      }
    }
  }

  vscode.commands.registerCommand(
    Command.RESET,
    catchErrors(async () => {
      runningServerStatusBarItem.hide();
      outputChannel.appendLine("Resetting Preview.js...");
      const state = await currentState;
      if (state) {
        state.dispose();
      }
      currentState = createState({
        outputChannel,
        runningServerStatusBarItem,
        onDispose,
      });
    })
  );

  vscode.commands.registerCommand(
    Command.START,
    catchErrors(async (document?: vscode.TextDocument, id?: string) => {
      const state = await currentState;
      if (!state) {
        vscode.window.showErrorMessage(
          "Preview.js was unable to start successfully. Please check Preview.js output panel and consider filing a bug at https://github.com/fwouts/previewjs/issues."
        );
        return;
      }
      if (typeof id !== "string") {
        // If invoked from clicking the button, the value may be { groupId: 0 }.
        id = undefined;
      }
      const editor = vscode.window.activeTextEditor;
      let textDocument: vscode.TextDocument;
      if (!document?.fileName) {
        if (editor?.document) {
          textDocument = editor.document;
        } else {
          vscode.window.showErrorMessage("No document selected.");
          return;
        }
      } else {
        textDocument = document;
      }

      const crawlFileResponse = await state.crawlFile(textDocument);
      if (!crawlFileResponse.rootDir) {
        vscode.window.showErrorMessage(
          `No compatible workspace detected from ${textDocument.fileName}`
        );
        return;
      }

      vscode.window.withProgress(
        {
          location: isPreviewServerRunning(state, crawlFileResponse.rootDir)
            ? vscode.ProgressLocation.Window
            : vscode.ProgressLocation.Notification,
          cancellable: true,
          title: "Spinning up Preview.js",
        },
        async (_progress, cancellationToken) => {
          if (id === undefined) {
            const offset = editor?.selection.active
              ? textDocument.offsetAt(editor.selection.active)
              : 0;
            const previewable =
              crawlFileResponse.previewables.find(
                (c) => offset >= c.start && offset <= c.end
              ) || crawlFileResponse.previewables[0];
            if (!previewable) {
              vscode.window.showErrorMessage(
                `No component or story was found at offset ${offset}`
              );
              return;
            }
            id = previewable.id;
          }
          const preview = await ensurePreviewServerStarted(
            state,
            crawlFileResponse.rootDir
          );
          if (cancellationToken.isCancellationRequested) {
            await ensurePreviewServerStopped(state);
            return;
          }
          runningServerStatusBarItem.text = `🟢 Preview.js running at ${preview.url}`;
          runningServerStatusBarItem.show();
          updatePreviewPanel(state, preview.url, id, onError);
        }
      );
    })
  );

  vscode.commands.registerCommand(Command.OPEN_MENU, async () => {
    const stopServerPick = "Stop Preview.js server";
    const openExternalBrowserPick = "Open in external browser";
    const pick = await vscode.window.showQuickPick([
      stopServerPick,
      openExternalBrowserPick,
    ]);
    if (pick === stopServerPick) {
      vscode.commands.executeCommand(Command.STOP);
    } else {
      vscode.commands.executeCommand(Command.OPEN_IN_EXTERNAL_BROWSER);
    }
  });

  vscode.commands.registerCommand(Command.STOP, async () => {
    runningServerStatusBarItem.hide();
    const state = await currentState;
    if (!state) {
      return;
    }
    closePreviewPanel(state);
    await ensurePreviewServerStopped(state);
  });

  vscode.commands.registerCommand(
    Command.OPEN_IN_EXTERNAL_BROWSER,
    async () => {
      const state = await currentState;
      if (!state?.currentPreview) {
        return;
      }
      vscode.env.openExternal(vscode.Uri.parse(state.currentPreview.url));
    }
  );
}

export async function deactivate() {
  await dispose();
  dispose = async () => {
    // Do nothing.
  };
}
