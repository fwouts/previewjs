import { destroyDaemon } from "@previewjs/daemon/client";
import fs from "fs";
import path from "path";
import vscode from "vscode";
import { clientId } from "./client-id";
import { closePreviewPanel, updatePreviewPanel } from "./preview-panel";
import { ensurePreviewServerStarted } from "./preview-server";
import { daemonLockFilePath } from "./start-daemon";
import { createState } from "./state";

const codeLensLanguages = [
  "javascript",
  "javascriptreact",
  "jsx",
  "svelte",
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

export async function activate() {
  const outputChannel = vscode.window.createOutputChannel("Preview.js");
  let currentState = createState({ outputChannel });

  const config = vscode.workspace.getConfiguration();
  let focusedOutputChannelForError = false;

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
    const state = await currentState;
    if (state) {
      await state.client.updateClientStatus({
        clientId,
        alive: false,
      });
      await closePreviewPanel(state);
    }
    outputChannel.dispose();
  };

  vscode.window.onDidChangeActiveTextEditor(async (e) => {
    const state = await currentState;
    if (!state) {
      return;
    }
    const components = await state.getComponents(e?.document);
    vscode.commands.executeCommand(
      "setContext",
      "previewjs.componentsDetected",
      components.length > 0
    );
  });

  if (config.get("previewjs.codelens", true)) {
    vscode.languages.registerCodeLensProvider(codeLensLanguages, {
      provideCodeLenses: catchErrors(async (document: vscode.TextDocument) => {
        const state = await currentState;
        if (!state) {
          return;
        }
        const components = await state.getComponents(document);
        return components.map((c) => {
          const start = document.positionAt(c.start + 2);
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
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      await updateDocument(e.document);
    });
    vscode.workspace.onDidSaveTextDocument(async (e) => {
      await updateDocument(e, true);
    });
    async function updateDocument(
      document: vscode.TextDocument,
      saved = false
    ) {
      const state = await currentState;
      if (
        !state ||
        !path.isAbsolute(document.fileName) ||
        !watchedExtensions.has(path.extname(document.fileName))
      ) {
        return;
      }
      state.client.updatePendingFile({
        absoluteFilePath: document.fileName,
        utf8Content: saved ? null : document.getText(),
      });
    }
  }

  vscode.commands.registerCommand(
    "previewjs.reset",
    catchErrors(async () => {
      outputChannel.appendLine("Resetting Preview.js...");
      const state = await currentState;
      if (state) {
        state.dispose();
      }
      currentState = Promise.resolve(null);
      destroyDaemon(daemonLockFilePath);
      if (state) {
        for (const rootDirPath of Object.values(state.workspaces)) {
          fs.rmSync(path.join(rootDirPath, "node_modules", ".previewjs"), {
            recursive: true,
            force: true,
          });
        }
      }
      currentState = createState({ outputChannel });
    })
  );

  vscode.commands.registerCommand(
    "previewjs.open",
    catchErrors(
      async (document?: vscode.TextDocument, componentId?: string) => {
        const state = await currentState;
        if (!state) {
          vscode.window.showErrorMessage(
            "Preview.js was unable to start successfully. Please check Preview.js output panel and consider filing a bug at https://github.com/fwouts/previewjs/issues."
          );
          return;
        }
        if (typeof componentId !== "string") {
          // If invoked from clicking the button, the value may be { groupId: 0 }.
          componentId = undefined;
        }
        const editor = vscode.window.activeTextEditor;
        if (!document?.fileName) {
          if (editor?.document) {
            document = editor.document;
          } else {
            vscode.window.showErrorMessage("No document selected.");
            return;
          }
        }
        const workspaceId = await state.getWorkspaceId(document);
        if (!workspaceId) {
          vscode.window.showErrorMessage(
            `No compatible workspace detected from ${document.fileName}`
          );
          return;
        }
        if (componentId === undefined) {
          const offset = editor?.selection.active
            ? document.offsetAt(editor.selection.active)
            : 0;
          const components = await state.getComponents(document);
          const component =
            components.find((c) => offset >= c.start && offset <= c.end) ||
            components[0];
          if (!component) {
            vscode.window.showErrorMessage(
              `No component was found at offset ${offset}`
            );
            return;
          }
          componentId = component.componentId;
        }
        const preview = await ensurePreviewServerStarted(state, workspaceId);
        updatePreviewPanel(state, preview.url, componentId);
      }
    )
  );
}

export async function deactivate() {
  await dispose();
  dispose = async () => {
    // Do nothing.
  };
}
