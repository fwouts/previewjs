import { Endpoint, RequestOf, ResponseOf } from "@previewjs/api";

export interface Api {
  request<E extends Endpoint<unknown, unknown>>(
    ...[endpoint, request]: RequestOf<E> extends void ? [E] : [E, RequestOf<E>]
  ): Promise<ResponseOf<E>>;
}
