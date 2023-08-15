/* eslint-disable no-console */
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
  listener: (event) => {
    console.log(event);
  },
});

window.addEventListener("message", (event: MessageEvent) => {
  if (event.data && event.data.kind === "navigate") {
    history.pushState(null, "", `/?p=${encodeURIComponent(event.data.id)}`);
    onUrlChanged().catch(console.error);
  }
});
window.addEventListener("popstate", () => {
  onUrlChanged().catch(console.error);
});
iframeController.start();
onUrlChanged().catch(console.error);

async function onUrlChanged() {
  const urlParams = new URLSearchParams(document.location.search);
  const id = urlParams.get("p") || "";
  if (!id.includes(":")) {
    return;
  }
  iframeController.resetIframe(id);
  const computePropsResponse = await rpcApi.request(RPCs.ComputeProps, {
    ids: [id],
  });
  const props = computePropsResponse.props[id]!;
  const autogenCallbackProps = await generateCallbackProps(
    props,
    computePropsResponse.types
  );
  iframeController.loadComponent({
    id,
    propsAssignmentSource: transpile(
      await generatePropsAssignmentSource(
        props,
        autogenCallbackProps.keys,
        computePropsResponse.types
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
