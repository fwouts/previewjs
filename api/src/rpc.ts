export type RPC<_Request, _Response> = {
  path: string;
};

export type RequestOf<E> = E extends RPC<infer Request, any> ? Request : never;
export type ResponseOf<E> = E extends RPC<any, infer Response>
  ? Response
  : never;

export type WrappedResponse<Response> =
  | {
      kind: "success";
      response: Response;
    }
  | {
      kind: "error";
      message: string;
    };
