import { Api, Endpoint, RequestOf, ResponseOf } from "@previewjs/api";
import axios from "axios";

export function createWebApi(url: string): Api {
  return new WebApi(url);
}

class WebApi implements Api {
  private readonly url: string;

  constructor(url: string) {
    if (!url.endsWith("/")) {
      url += "/";
    }
    this.url = url;
  }

  async request<E extends Endpoint<unknown, unknown>>(
    ...[endpoint, request]: RequestOf<E> extends void ? [E] : [E, RequestOf<E>]
  ): Promise<ResponseOf<E>> {
    const { data } = await axios.post<ResponseOf<E>>(
      `${this.url}${endpoint.path}`,
      request
    );
    return data;
  }
}
