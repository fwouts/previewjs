import type { RequestOf, ResponseOf, RPC } from "./rpc.js";

export interface Api {
  request<E extends RPC<unknown, unknown>>(
    ...[endpoint, request]: RequestOf<E> extends void ? [E] : [E, RequestOf<E>]
  ): Promise<ResponseOf<E>>;
}

export type FrameworkPluginInfo = {
  name: string;
  apiVersion: number;
};
