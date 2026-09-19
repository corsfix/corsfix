export interface CorsfixOptions {
  cache?: boolean;
  headers?: Record<string, string>;
}

export interface CorsfixRequestInit extends RequestInit {
  corsfix?: CorsfixOptions;
}

export function fetch(
  input: RequestInfo | URL,
  init?: CorsfixRequestInit
): Promise<Response>;

declare const corsfix: {
  fetch: typeof fetch;
};

export default corsfix;
