import { MiddlewareNext, Response } from "hyper-express";
import { CorsfixRequest } from "../types/api";

export const detectApiKeyRequest = (
  req: CorsfixRequest,
  _res: Response,
  next: MiddlewareNext
) => {
  req.ctx_api_key_request = !!(
    req.header("x-corsfix-key") ||
    req
      .header("access-control-request-headers")
      ?.split(",")
      .map((header) => header.trim().toLowerCase())
      .includes("x-corsfix-key")
  );
  next();
};
