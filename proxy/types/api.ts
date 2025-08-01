import { Request } from "hyper-express";

export interface CorsfixRequest extends Request {
  ctx_bytes?: number;
  ctx_user_id?: string;
  ctx_origin?: string;
  ctx_cache?: boolean;
}

export interface Application {
  id?: string;
  user_id: string;
  origin_domains: string[];
  target_domains: string[];
}

export interface Subscription {
  user_id: string;
  product_id: string;
  active: boolean;
}

export interface RateLimitConfig {
  key: string;
  rpm: number;
  local?: boolean;
}
