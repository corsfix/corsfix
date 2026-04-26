import { Dispatcher } from "undici";
import ipaddr from "ipaddr.js";

const BLOCKED_RANGES = [
  "unspecified",
  "linkLocal",
  "loopback",
  "private",
  "reserved",
  "uniqueLocal",
  "ipv4Mapped",
  "6to4",
  "multicast",
  "rfc6052",
  "rfc6145",
];

// Must be composed alongside (and outside of) `interceptors.dns` so the
// hostname has already been resolved to an IP literal when we check.
export const ssrfInterceptor = (dispatch: Dispatcher.Dispatch) => {
  return (
    opts: Dispatcher.DispatchOptions,
    handler: Dispatcher.DispatchHandler
  ) => {
    const url = new URL(opts.origin || "");
    let blocked = !["http:", "https:"].includes(url.protocol);

    if (!blocked) {
      const address = url.hostname.replace(/^\[|\]$/g, "");
      try {
        const range = ipaddr.parse(address).range();
        if (BLOCKED_RANGES.includes(range)) blocked = true;
      } catch {
        blocked = true;
      }
    }

    if (blocked) {
      opts.origin = "http://127.0.0.1";
      opts.path = "/error";
    }

    return dispatch(opts, handler);
  };
};
