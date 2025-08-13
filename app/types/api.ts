import * as z from "zod";

export interface SecretItem {
  id?: string;
  application_id: string;
  name: string;
  note: string;
  value?: string;
  masked_value?: string;
}

export interface Application {
  id: string;
  name: string;
  originDomains?: string[];
  targetDomains?: string[];
  secrets?: SecretItem[];
}

export const UpsertApplicationSchema = z.object({
  name: z.string().max(64),
  originDomains: z.array(z.string().max(255)).min(1).max(8),
  targetDomains: z.array(z.string().max(255)).min(1).max(8),
});

export type UpsertApplication = z.input<typeof UpsertApplicationSchema>;

export interface User {
  id: string;
  email: string;
}

export interface Subscription {
  name: string;
  product_id?: string;
  customer_id: string;
  bandwidth: number;
  active: boolean;
}

export const UpsertSecretSchema = z.object({
  application_id: z.string().max(32),
  name: z.string().max(64),
  note: z.string().max(255),
  value: z.string().max(255),
});

export type UpsertSecret = z.input<typeof UpsertSecretSchema>;

export const GetMetricsSchema = z.object({
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid start date format",
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid end date format",
  }),
});

export type GetMetrics = z.input<typeof GetMetricsSchema>;

export interface AuthorizationResult {
  allowed: boolean;
  message?: string;
}

export interface DeleteSecret {
  application_id: string;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface Metric {
  req_count: number;
  bytes: number;
}

export interface MetricPoint {
  date: Date;
  req_count: number;
  bytes: number;
}
