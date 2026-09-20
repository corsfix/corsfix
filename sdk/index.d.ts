export interface CorsfixOptions {
  /**
   * Cache the response on the proxy. Pass a duration such as "10s", "10m",
   * "2h" or "1d" (maximum 1 day), a number of seconds, or `true` to use the
   * proxy's default duration.
   */
  cache?: boolean | number | string;
  /** Headers the proxy should send to the target, including ones browsers normally forbid. */
  headers?: Record<string, string>;
  /** API key, for when domain whitelisting is not an option. Sent as x-corsfix-key. */
  apiKey?: string;
  /**
   * Proxy origin to use instead of https://proxy.corsfix.com, e.g.
   * "https://lite.corsfix.com", a regional endpoint such as
   * "https://proxy-eu.corsfix.com", or a self-hosted instance.
   */
  proxyUrl?: string;
}

export interface CorsfixRequestInit extends RequestInit {
  /** Corsfix-specific configuration. */
  corsfix?: CorsfixOptions;
}

/**
 * Error codes the Corsfix proxy can return. The proxy may add new codes over
 * time, so any string is accepted; the listed values are the known ones.
 */
export type CorsfixErrorCode =
  | "domain_not_registered"
  | "free_tier_concurrency_limit"
  | "free_tier_transfer_limit"
  | "invalid_api_key"
  | "invalid_origin"
  | "invalid_referer"
  | "invalid_subscription"
  | "invalid_url"
  | "no_active_plan"
  | "payload_too_large"
  | "plan_mismatch"
  | "rate_limited"
  | "region_not_allowed"
  | "response_not_text"
  | "response_too_large"
  | "target_not_allowed"
  | "target_not_found"
  | "target_unreachable"
  | "timeout"
  | "trial_limit_reached"
  | "uncaught_error"
  | "unknown_error"
  | "user_not_found"
  | (string & {});

/**
 * Thrown by `corsfix.fetch` when the Corsfix proxy itself rejects or fails
 * the request. Errors returned by the target server (e.g. a 404 from the API
 * you are calling) are NOT converted into CorsfixError; they come back as a
 * normal Response, exactly like native fetch.
 */
export declare class CorsfixError extends Error {
  readonly name: "CorsfixError";
  /** Machine-readable error code, e.g. "rate_limited". */
  readonly code: CorsfixErrorCode;
  /** HTTP status code of the proxy's error response. */
  readonly status: number;
  /** Guidance for the site owner integrating Corsfix. */
  readonly ifYouAreAdmin?: string;
  /** Guidance suitable for showing to end users. */
  readonly ifYouAreUser?: string;
  /** The raw proxy response; its body is still readable. */
  readonly response: Response;
}

declare const corsfix: {
  fetch(
    input: RequestInfo | URL,
    init?: CorsfixRequestInit
  ): Promise<Response>;
  CorsfixError: typeof CorsfixError;
};

export default corsfix;
