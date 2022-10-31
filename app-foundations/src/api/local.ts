import type {
  Api,
  RequestOf,
  ResponseOf,
  RPC,
  WrappedResponse,
} from "@previewjs/api";
import axios from "axios";

export function createRpcApi(url: string): Api {
  return new LocalApi(url);
}

class LocalApi {
  private readonly url: string;

  constructor(url: string) {
    if (!url.endsWith("/")) {
      url += "/";
    }
    this.url = url;
  }

  async request<E extends RPC<unknown, unknown>>(
    ...[endpoint, request]: RequestOf<E> extends void ? [E] : [E, RequestOf<E>]
  ): Promise<ResponseOf<E>> {
    const { data } = await axios.post<WrappedResponse<ResponseOf<E>>>(
      `${this.url}${endpoint.path}`,
      request
    );
    if (data.kind === "error") {
      throw new Error(data.message);
    }
    return data.response;
  }
}
