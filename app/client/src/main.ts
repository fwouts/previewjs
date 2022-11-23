import { createRpcApi, PreviewState } from "@previewjs/app-foundations";

const rpcApi = createRpcApi("/api/");
const iframe = document.getElementById("root") as HTMLIFrameElement;
const state = new PreviewState(rpcApi, () => iframe);
state.start().catch(console.error);
