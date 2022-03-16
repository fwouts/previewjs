import { install, isInstalled, load } from "@previewjs/loader";
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
  const outputChannel = vscode.window.createOutputChannel("Preview.js");

  const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }

  let requirePath = process.env.PREVIEWJS_MODULES_DIR;
  if (!requirePath) {
    requirePath = path.join(__dirname, "installed");
    if (!(await isInstalled({ installDir: requirePath }))) {
      outputChannel.show();
      await install({
        installDir: requirePath,
        onOutput: (chunk) => {
          outputChannel.append(chunk);
        },
      });
    }
  }

  const previewjs = await load({
    installDir: requirePath,
    packageName,
  });

  function getWorkspace(absoluteFilePath: string) {
    return previewjs.getWorkspace({
      versionCode: `vscode-${version}`,
      logLevel: "info",
      absoluteFilePath,
    });
  }

  function catchErrors<F extends Function>(f: F) {
    return async (...args: F extends (...args: infer A) => any ? A : never) => {
      try {
        return await f(...args);
      } catch (e: unknown) {
        outputChannel.show();
        outputChannel.appendLine(
          e instanceof Error ? e.stack || e.message : `${e}`
        );
        throw e;
      }
    };
  }

  dispose = async () => {
    outputChannel.dispose();
    await previewjs.dispose();
  };

  await openUsageOnFirstTimeStart(context);
  if (config.get("previewjs.codelens", true)) {
    vscode.languages.registerCodeLensProvider(codeLensLanguages, {
      provideCodeLenses: catchErrors(async (document: vscode.TextDocument) => {
        const workspace = await getWorkspace(document.fileName);
        if (!workspace) {
          return [];
        }
        const components = await workspace.frameworkPlugin.detectComponents(
          workspace.typeAnalyzer,
          [document.fileName]
        );
        return components.map((c) => {
          const start = document.positionAt(c.offsets[0]![0]! + 2);
          const lens = new vscode.CodeLens(new vscode.Range(start, start));
          lens.command = {
            command: "previewjs.open",
            arguments: [
              document,
              previewjs.core.generateComponentId({
                currentFilePath: path.relative(
                  workspace.rootDirPath,
                  c.absoluteFilePath
                ),
                name: c.name,
              }),
            ],
            title: `Open ${c.name} in Preview.js`,
          };
          return lens;
        });
      }),
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
      catchErrors(
        async (document?: vscode.TextDocument, componentId?: string) => {
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
          const workspace = await getWorkspace(document.fileName);
          if (!workspace) {
            return;
          }
          if (componentId === undefined) {
            if (!editor) {
              return;
            }
            const offset = document.offsetAt(editor.selection.active);
            const components = (
              await workspace.frameworkPlugin.detectComponents(
                workspace.typeAnalyzer,
                [document.fileName]
              )
            )
              .map((c) => {
                return c.offsets
                  .filter(([start, end]) => {
                    return offset >= start && offset <= end;
                  })
                  .map(([start]) => ({
                    componentName: c.name,
                    exported: c.exported,
                    offset: start,
                    componentId: previewjs.core.generateComponentId({
                      currentFilePath: path.relative(
                        workspace.rootDirPath,
                        c.absoluteFilePath
                      ),
                      name: c.name,
                    }),
                  }));
              })
              .flat();
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
      )
    );
  }
}

export async function deactivate() {
  await closePreviewPanel();
  await ensurePreviewServerStopped();
  await dispose();
  dispose = async () => {};
}
