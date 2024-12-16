import type {
  RequestOf,
  ResponseOf,
  RPC,
  WrappedResponse,
} from "@previewjs/api";
import type { Logger } from "pino";

export class ApiRouter {
  private handlers = new Map<string, RequestHandler<any, any>>();

  constructor(private readonly logger: Logger) {}

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
    this.logger.debug(`RPC ${path} invoked`);
    try {
      const response = await handler(request);
      return {
        kind: "success",
        response,
      };
    } catch (e: any) {
      this.logger.error(`RPC ${path} failed: ${e}`);
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
