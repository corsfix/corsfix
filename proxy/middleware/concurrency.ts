import { MiddlewareNext, Response } from "hyper-express";
import { CorsfixRequest } from "../types/api";
import { trackConcurrency } from "../lib/services/concurrencyService";

export const handleConcurrency = (
  req: CorsfixRequest,
  res: Response,
  next: MiddlewareNext
) => {
  res.once("close", () => {
    if (req.ctx_user_id) {
      trackConcurrency(req.ctx_user_id, req.header("x-real-ip") || req.ip);
    }
  });
  next();
};
