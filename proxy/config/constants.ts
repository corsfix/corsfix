import "dotenv/config";

const ENV = process.env.NODE_ENV || "development";

export interface Product {
  id: string;
  name: string;
  rpm: number;
}

interface Config {
  products: Product[];
}

const configList: Record<string, Config> = {
  development: {
    products: [
      {
        id: "a31fbaa6-9e5d-4ddf-94d6-7e373a7ddfeb",
        name: "lite",
        rpm: 60,
      },
      {
        id: "46b89204-f1cf-4e12-a84f-bc00efc0fc70",
        name: "plus",
        rpm: 120,
      },
      {
        id: "f6381a0c-71db-4d6e-acaf-ce332bf01fb0",
        name: "pro",
        rpm: 180,
      },
    ],
  },
  production: {
    products: [
      {
        id: "5bb1ff84-60ef-4ee2-b188-35d1203908a5",
        name: "lite",
        rpm: 60,
      },
      {
        id: "43398e9e-7f95-45e9-88e3-49d4ba3d4b94",
        name: "plus",
        rpm: 120,
      },
      {
        id: "f4821fff-6471-432b-8885-4ef0cd7b7fd8",
        name: "pro",
        rpm: 180,
      },
    ],
  },
};

interface FreeTierLimit {
  req_count: number;
  bytes: number;
  app_count: number;
  secret_count: number;
  rpm: number;
}

export const freeTierLimit: FreeTierLimit = {
  req_count: 500,
  bytes: 50_000_000,
  app_count: 3,
  secret_count: 1,
  rpm: 60,
};

export const config = configList[ENV];
export const IS_CLOUD = process.env.CLOUD === "true";
export const IS_SELFHOST = !IS_CLOUD;
