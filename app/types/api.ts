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

export interface UpsertApplication {
  name: string;
  originDomains: string[];
  targetDomains: string[];
}

export interface User {
  id: string;
  email: string;
}

export interface Subscription {
  name: string;
  product_id?: string;
  customer_id: string;
  active: boolean;
}

export interface UpsertSecret {
  application_id: string;
  name: string;
  note: string;
  value: string;
}

export interface DeleteSecret {
  application_id: string;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}
