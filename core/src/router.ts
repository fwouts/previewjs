import type {
  Endpoint,
  RequestOf,
  ResponseOf,
  WrappedResponse,
} from "@previewjs/api";
import type * as express from "express";

export class ApiRouter {
  private handlers = new Map<string, RequestHandler<any, any>>();

  async handle(
    path: string,
    request: unknown,
    expressRequest: express.Request,
    expressResponse: express.Response
  ): Promise<WrappedResponse<unknown>> {
    const handler = this.handlers.get(path);
    if (!handler) {
      return {
        kind: "error",
        message: `No handler is registered for path '${path}'`,
      };
    }
    try {
      const response = await handler(request, expressRequest, expressResponse);
      return {
        kind: "success",
        response,
      };
    } catch (e: any) {
      console.error(`Handler ${path} failed`, e);
      return {
        kind: "error",
        message: e.message,
      };
    }
  }

  registerEndpoint: RegisterEndpoint = (endpoint, handler) => {
    if (this.handlers.has(endpoint.path)) {
      throw new Error(
        `Multiple handlers registered for endpoint '${endpoint.path}'`
      );
    }
    this.handlers.set(endpoint.path, handler);
  };
}

export type RegisterEndpoint = <E extends Endpoint<any, any>>(
  endpoint: E,
  handler: RequestHandler<RequestOf<E>, ResponseOf<E>>
) => void;

export type RequestHandler<Req, Res> = (
  request: Req,
  expressRequest: express.Request,
  expressResponse: express.Response
) => Promise<Res>;

export type RequestHandlerForEndpoint<E> = E extends Endpoint<
  infer Req,
  infer Res
>
  ? RequestHandler<Req, Res>
  : never;
