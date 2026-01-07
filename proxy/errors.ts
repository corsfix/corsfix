import { Response } from "hyper-express";

export type CorsfixError =
  | "domain_not_registered"
  | "invalid_api_key"
  | "invalid_origin"
  | "invalid_referer"
  | "invalid_subscription"
  | "invalid_url"
  | "payload_too_large"
  | "rate_limited"
  | "response_not_text"
  | "response_too_large"
  | "target_not_allowed"
  | "target_not_found"
  | "target_unreachable"
  | "timeout"
  | "trial_expired"
  | "trial_limit_reached"
  | "uncaught_error"
  | "unknown_error"
  | "user_not_found";

interface ErrorDefinition {
  status: number;
  message: string;
  if_you_are_admin: string;
  if_you_are_user: string;
}

const errorDefinitions: Record<CorsfixError, ErrorDefinition> = {
  domain_not_registered: {
    status: 403,
    message: "This website domain hasn't been registered to use the proxy",
    if_you_are_admin:
      "Please add your website domain ({domain}) to the dashboard to use the proxy",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  invalid_api_key: {
    status: 403,
    message: "The provided API key is invalid or has been revoked",
    if_you_are_admin: "Check that your API key is correct in your dashboard",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  invalid_origin: {
    status: 400,
    message: "Request is missing a valid Origin header",
    if_you_are_admin:
      "Ensure requests are made from browser JavaScript (fetch/AJAX), not server-side or direct access",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  invalid_referer: {
    status: 400,
    message: "JSONP request is missing a valid Referer header",
    if_you_are_admin: "Ensure JSONP requests include the Referer header",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  invalid_subscription: {
    status: 400,
    message: "The subscription configuration is invalid",
    if_you_are_admin: "Please contact Corsfix support about your subscription",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  invalid_url: {
    status: 400,
    message: "The target URL is invalid or malformed",
    if_you_are_admin:
      "Check the URL format - it must be a valid HTTP/HTTPS URL",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  payload_too_large: {
    status: 413,
    message: "The request payload exceeds the maximum allowed size (5MB)",
    if_you_are_admin:
      "Reduce your request payload size or contact support for higher limits",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  rate_limited: {
    status: 429,
    message: "Too many requests in a short period",
    if_you_are_admin:
      "You've exceeded your rate limit - consider upgrading your plan",
    if_you_are_user: "Please wait a moment and try again",
  },
  response_not_text: {
    status: 400,
    message: "The response is binary data, not valid text",
    if_you_are_admin:
      "The target returned non-text content - disable text-only mode or ensure the target returns text",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  response_too_large: {
    status: 400,
    message: "The response exceeds the maximum allowed size (1MB for text/JSONP)",
    if_you_are_admin:
      "The target response is too large - consider pagination or upgrading your plan",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  target_not_allowed: {
    status: 403,
    message: "The target domain is not in the allowed list",
    if_you_are_admin:
      "Add the target domain ({domain}) to your allowed domains in the dashboard",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  target_not_found: {
    status: 404,
    message: "The target domain could not be found",
    if_you_are_admin:
      "Check that the target URL is correct and the domain exists",
    if_you_are_user: "The requested resource is currently unavailable",
  },
  target_unreachable: {
    status: 502,
    message: "Unable to connect to the target server",
    if_you_are_admin:
      "The target server may be down or blocking requests - check the target URL",
    if_you_are_user: "The requested resource is currently unavailable",
  },
  timeout: {
    status: 504,
    message: "The request to the target server timed out",
    if_you_are_admin:
      "The target server took too long to respond - check target availability",
    if_you_are_user: "The requested resource is currently unavailable",
  },
  trial_expired: {
    status: 403,
    message: "The free trial period has ended",
    if_you_are_admin:
      "Please upgrade your plan to continue using the proxy (https://app.corsfix.com/billing)",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  trial_limit_reached: {
    status: 403,
    message: "The free trial usage limit has been reached",
    if_you_are_admin:
      "Please upgrade your plan to continue using the proxy (https://app.corsfix.com/billing)",
    if_you_are_user: "Please contact the website owner about this issue",
  },
  uncaught_error: {
    status: 500,
    message: "An unexpected error occurred while processing the request",
    if_you_are_admin:
      "Please try again or contact Corsfix support if the issue persists",
    if_you_are_user: "Please try again later",
  },
  unknown_error: {
    status: 500,
    message: "An unknown error occurred",
    if_you_are_admin:
      "Please try again or contact Corsfix support if the issue persists",
    if_you_are_user: "Please try again later",
  },
  user_not_found: {
    status: 403,
    message: "The application owner account was not found",
    if_you_are_admin: "Please contact Corsfix support about your account",
    if_you_are_user: "Please contact the website owner about this issue",
  },
};

export interface ErrorContext {
  domain?: string;
}

function replaceTemplates(str: string, context?: ErrorContext): string {
  if (!context) return str;
  return str.replace(/\{domain\}/g, context.domain || "");
}

export function sendCorsfixError(
  res: Response,
  error: CorsfixError,
  context?: ErrorContext
): Response {
  const definition = errorDefinitions[error];

  const body = {
    corsfix_error: error,
    message: replaceTemplates(definition.message, context),
    if_you_are_admin: replaceTemplates(definition.if_you_are_admin, context),
    if_you_are_user: replaceTemplates(definition.if_you_are_user, context),
  };

  res.header("X-Corsfix-Status", error, true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Expose-Headers", "*");
  res.header("Content-Type", "application/json");

  return res.status(definition.status).end(JSON.stringify(body, null, 2));
}
