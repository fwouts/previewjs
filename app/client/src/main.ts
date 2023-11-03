/* eslint-disable no-console */
import { decodePreviewableId } from "@previewjs/analyzer-api";
import { createAxiosApi, RPCs } from "@previewjs/api";
import { createController } from "@previewjs/iframe";
import {
  generateCallbackProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";
import ts from "typescript";

const iframe = document.getElementById("root") as HTMLIFrameElement;
const rpcApi = createAxiosApi("/api/");
const iframeController = createController({
  getIframe: () => iframe,
  onStateUpdate: (state) => {
    console.log(state);
  },
});

window.addEventListener("message", (event: MessageEvent) => {
  if (event.data && event.data.kind === "navigate") {
    history.pushState(
      null,
      "",
      `/?p=${encodeURIComponent(event.data.previewableId)}`
    );
    onUrlChanged().catch(console.error);
  }
});
window.addEventListener("popstate", () => {
  onUrlChanged().catch(console.error);
});
onUrlChanged().catch(console.error);

async function onUrlChanged() {
  const urlParams = new URLSearchParams(document.location.search);
  const previewableId = urlParams.get("p") || "";
  if (!previewableId) {
    return;
  }
  // Note: The call to decodePreviewableId() is important here. It acts as a test that compiling the @previewjs/analyzer-api
  // module with Vite does not cause a crash.
  console.log(`URL changed, rendering:`, decodePreviewableId(previewableId));
  const analyzeResponse = await rpcApi.request(RPCs.Analyze, {
    previewableIds: [previewableId],
  });
  const props = analyzeResponse.previewables.find(
    (p) => p.id === previewableId
  )!.props;
  const autogenCallbackProps = await generateCallbackProps(
    props,
    analyzeResponse.types
  );
  iframeController.render(previewableId, {
    propsAssignmentSource: transpile(
      await generatePropsAssignmentSource(
        props,
        autogenCallbackProps.keys,
        analyzeResponse.types
      )
    ),
    autogenCallbackPropsSource: transpile(
      `autogenCallbackProps = ${autogenCallbackProps.source}`
    ),
  });
}

function transpile(source: string) {
  // Transform JSX if required.
  try {
    return ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        jsxFactory: "__jsxFactory__",
      },
    }).outputText;
  } catch (e) {
    throw new Error(`Error transforming source:\n${source}\n\n${e}`);
  }
}
