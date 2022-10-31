import type {
  RequestOf,
  ResponseOf,
  RPC,
  WrappedResponse,
} from "@previewjs/api";

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
      console.error(`Handler ${path} failed`, e);
      return {
        kind: "error",
        message: e.message,
      };
    }
  }

  registerRPC: RegisterRPC = (endpoint, handler) => {
    if (this.handlers.has(endpoint.path)) {
      throw new Error(
        `Multiple handlers registered for endpoint '${endpoint.path}'`
      );
    }
    this.handlers.set(endpoint.path, handler);
  };
}

export type RegisterRPC = <E extends RPC<any, any>>(
  endpoint: E,
  handler: RequestHandler<RequestOf<E>, ResponseOf<E>>
) => void;

export type RequestHandler<Req, Res> = (request: Req) => Promise<Res>;

export type RequestHandlerForRPC<E> = E extends RPC<infer Req, infer Res>
  ? RequestHandler<Req, Res>
  : never;
