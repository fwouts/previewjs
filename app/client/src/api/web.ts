import { Endpoint, RequestOf, ResponseOf } from "@previewjs/core/api";
import axios from "axios";

export class WebApi {
  private readonly url: string;

  constructor(url: string) {
    if (!url.endsWith("/")) {
      url += "/";
    }
    this.url = url;
  }

  async request<E extends Endpoint<unknown, unknown>>(
    endpoint: E,
    request: RequestOf<E>
  ): Promise<ResponseOf<E>> {
    const { data } = await axios.post<ResponseOf<E>>(
      `${this.url}${endpoint.id}`,
      request
    );
    return data;
  }
}
