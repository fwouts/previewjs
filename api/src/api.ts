import { Endpoint, RequestOf, ResponseOf } from "./endpoint";

export interface Api {
  request<E extends Endpoint<unknown, unknown>>(
    ...[endpoint, request]: RequestOf<E> extends void ? [E] : [E, RequestOf<E>]
  ): Promise<ResponseOf<E>>;
}
