import { Request } from "hyper-express";

export interface CorsfixRequest extends Request {
  ctx_url?: URL;
  ctx_origin?: string;
  ctx_origin_domain?: string;
  ctx_target_domain?: string;
  ctx_callback?: string;
  ctx_user_id?: string;
  ctx_cached_request?: boolean;
  ctx_bytes?: number;
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

export interface Metric {
  req_count: number;
  bytes: number;
}
