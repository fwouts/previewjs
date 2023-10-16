import { parentPort, workerData } from "node:worker_threads";

if (!parentPort) {
  throw new Error(`Worker does not have parent port`);
}

const input = workerData as {};

parentPort.postMessage(parse(script));
