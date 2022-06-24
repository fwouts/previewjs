import { Endpoint, WrappedResponse } from "@previewjs/api";
import * as express from "express";

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

export type RegisterEndpoint = <Request, Response>(
  endpoint: Endpoint<Request, Response>,
  handler: RequestHandler<Request, Response>
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
