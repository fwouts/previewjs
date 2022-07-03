import type { Monaco } from "@monaco-editor/react";
import type monaco from "monaco-editor";
import { flattenDiagnosticMessageText } from "typescript";

// Source: https://stackoverflow.com/a/58372567
export async function revalidateMonacoEditor(
  monaco: Monaco,
  editor: monaco.editor.IStandaloneCodeEditor
) {
  const model = editor.getModel();
  if (!model) {
    return;
  }
  const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
  const worker = await getWorker(model.uri);
  const diagnostics = (
    await Promise.all([
      worker.getSyntacticDiagnostics(model.uri.toString()),
      worker.getSemanticDiagnostics(model.uri.toString()),
    ])
  ).reduce((a, it) => a.concat(it));

  const markers = diagnostics.map((d) => {
    const startPos = d.start || 0;
    const length = d.length || 0;
    const start = model.getPositionAt(startPos);
    const end = model.getPositionAt(startPos + length);
    return {
      severity: monaco.MarkerSeverity.Error,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
      message: flattenDiagnosticMessageText(d.messageText, "\n"),
    };
  });
  const owner = model.getLanguageId();
  monaco.editor.setModelMarkers(model, owner, markers);
}
