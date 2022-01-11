import { load } from "@previewjs/loader";
import { readFileSync } from "fs";
import path from "path";
import vscode from "vscode";
import { closePreviewPanel, updatePreviewPanel } from "./preview-panel";
import {
  ensurePreviewServerStarted,
  ensurePreviewServerStopped,
} from "./preview-server";
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

let dispose = async () => {
  // Do nothing.
};

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration();

  const previewjs = await load({
    installDir: path.join(__dirname, "installed"),
    status: {
      info: (message) => vscode.window.showInformationMessage(message),
      error: (message) => vscode.window.showErrorMessage(message),
    },
  });

  function getWorkspace(filePath: string) {
    return previewjs.getWorkspace({
      versionCode: `vscode-${version}`,
      logLevel: "info",
      filePath,
    });
  }

  dispose = async () => {
    await previewjs.dispose();
  };

  await openUsageOnFirstTimeStart(context);
  if (config.get("previewjs.codelens", true)) {
    vscode.languages.registerCodeLensProvider(codeLensLanguages, {
      provideCodeLenses: async (document, _token) => {
        const workspace = await getWorkspace(document.fileName);
        if (!workspace) {
          return [];
        }
        const components = await workspace.detectComponents(document.fileName);
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
      },
    });

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
        if (!path.isAbsolute(document.fileName)) {
          return;
        }
        previewjs.updateFileInMemory(
          document.fileName,
          saved ? null : document.getText()
        );
      }
    }

    vscode.commands.registerCommand(
      "previewjs.open",
      async (document?: vscode.TextDocument, componentId?: string) => {
        const editor = vscode.window.activeTextEditor;
        document ||= vscode.window.activeTextEditor?.document;
        if (!document || !document.fileName) {
          return;
        }
        const workspace = await getWorkspace(document.fileName);
        if (!workspace) {
          return;
        }
        if (componentId === undefined) {
          if (!editor) {
            return;
          }
          const offset = document.offsetAt(editor.selection.active);
          const components = await workspace.detectComponents(
            document.fileName,
            {
              offset,
            }
          );
          const component = components[0];
          if (!component) {
            vscode.window.showErrorMessage(
              `No component was found at offset ${offset}`
            );
            return;
          }
          componentId = component.componentId;
        }
        const preview = await ensurePreviewServerStarted(workspace);
        if (!preview) {
          throw new Error(`Unable to open preview (unsupported project)`);
        }
        updatePreviewPanel(preview.url(), componentId);
      }
    );
  }
}

export async function deactivate() {
  await closePreviewPanel();
  await ensurePreviewServerStopped();
  await dispose();
  dispose = async () => {};
}
