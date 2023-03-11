import path from "path";
import vscode from "vscode";
import { clientId } from "./client-id";
import { createComponentDetector } from "./component-detector";
import { closePreviewPanel, updatePreviewPanel } from "./preview-panel";
import { ensurePreviewServerStarted } from "./preview-server";
import { ensureDaemonRunning } from "./start-daemon";
import { createWorkspaceGetter } from "./workspaces";

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

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Preview.js");
  const getWorkspaceId = createWorkspaceGetter(outputChannel);
  const previewjsInitPromise = ensureDaemonRunning(outputChannel)
    .catch((e) => {
      outputChannel.appendLine(e.stack);
      return null;
    })
    .then((p) => {
      if (!p) {
        outputChannel.appendLine("Preview.js daemon could not be started.");
        outputChannel.show();
        return null;
      }
      return p;
    });
  const componentDetector = createComponentDetector(
    previewjsInitPromise,
    getWorkspaceId
  );

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
    const previewjsClient = await previewjsInitPromise;
    await previewjsClient?.updateClientStatus({
      clientId,
      alive: false,
    });
    outputChannel.dispose();
  };

  vscode.window.onDidChangeActiveTextEditor(async (e) => {
    const components = await componentDetector.getComponents(e?.document);
    vscode.commands.executeCommand(
      "setContext",
      "previewjs.componentsDetected",
      components.length > 0
    );
  });

  if (config.get("previewjs.codelens", true)) {
    vscode.languages.registerCodeLensProvider(codeLensLanguages, {
      provideCodeLenses: catchErrors(async (document: vscode.TextDocument) => {
        const components = await componentDetector.getComponents(document);
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
      const previewjsClient = await previewjsInitPromise;
      if (
        !previewjsClient ||
        !path.isAbsolute(document.fileName) ||
        !watchedExtensions.has(path.extname(document.fileName))
      ) {
        return;
      }
      previewjsClient.updatePendingFile({
        absoluteFilePath: document.fileName,
        utf8Content: saved ? null : document.getText(),
      });
    }
  }

  vscode.commands.registerCommand(
    "previewjs.open",
    catchErrors(
      async (document?: vscode.TextDocument, componentId?: string) => {
        const previewjsClient = await previewjsInitPromise;
        if (!previewjsClient) {
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
        const workspaceId = await getWorkspaceId(previewjsClient, document);
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
          const components = await componentDetector.getComponents(document);
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
  await dispose();
  await closePreviewPanel();
  dispose = async () => {
    // Do nothing.
  };
}
