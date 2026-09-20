import { MiddlewareNext, Response } from "hyper-express";
import { CorsfixRequest } from "../types/api";
import { trackConcurrency } from "../lib/services/concurrencyService";
import { getClientIp } from "../lib/util";

export const handleConcurrency = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  // Read the IP now: the underlying uWS request cannot be accessed once the
  // response has been sent, and "close" fires after that.
  const ip = getClientIp(req);
  res.once("close", () => {
    if (req.ctx_user_id) {
      trackConcurrency(req.ctx_user_id, ip);
    }
  });
  next();
};
