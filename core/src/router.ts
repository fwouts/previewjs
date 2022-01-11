import {
  Endpoint,
  RequestOf,
  ResponseOf,
  WrappedResponse,
} from "../api/endpoint";

export class ApiRouter {
  private handlers = new Map<string, RequestHandler<any, any>>();

  async handle(
    path: string,
    request: unknown
  ): Promise<WrappedResponse<unknown>> {
    const handler = this.handlers.get(path);
    if (!handler) {
      return {
        kind: "error",
        message: `No handler is registered for path '${path}'`,
      };
    }
    try {
      const response = await handler(request);
      return {
        kind: "success",
        response,
      };
    } catch (e: any) {
      console.warn(e);
      return {
        kind: "error",
        message: e.message,
      };
    }
  }

  onRequest<E extends Endpoint<any, any>>(
    endpoint: E,
    handler: RequestHandler<RequestOf<E>, ResponseOf<E>>
  ) {
    if (this.handlers.has(endpoint.id)) {
      throw new Error(
        `Multiple handlers registered for endpoint '${endpoint.id}'`
      );
    }
    this.handlers.set(endpoint.id, handler);
  }
}

export type RequestHandler<Request, Response> = (
  request: Request
) => Promise<Response>;
