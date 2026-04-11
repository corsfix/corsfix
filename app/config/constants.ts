const ENV = process.env.NODE_ENV;

export interface Product {
  id: string;
  name: string;
  price: string;
  rpm: number;
  bandwidth: number;
  link?: string;
  type: "standard" | "lite";
  regionSelection?: boolean;
  minCacheTtlSeconds?: number;
  concurrencyLimit?: number;
}

interface Config {
  products: Product[];
}

const configList: Record<string, Config> = {
  development: {
    products: [
      {
        id: "a31fbaa6-9e5d-4ddf-94d6-7e373a7ddfeb",
        name: "hobby",
        price: "5",
        rpm: 60,
        bandwidth: 25_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_wHdNRksqy8ahDKsr8ZNRRwp3OrBTYbbhmUTF4edt7po/redirect",
        type: "standard",
        regionSelection: false,
        minCacheTtlSeconds: 600,
        concurrencyLimit: 5,
      },
      {
        id: "46b89204-f1cf-4e12-a84f-bc00efc0fc70",
        name: "growth",
        price: "8",
        rpm: 120,
        bandwidth: 100_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_EK7Yv6QfrWNqPY6VaabXlBhQN5lgPKPXJqbRP0ayrzt/redirect",
        type: "standard",
        regionSelection: true,
        minCacheTtlSeconds: 60,
        concurrencyLimit: 25,
      },
      {
        id: "f6381a0c-71db-4d6e-acaf-ce332bf01fb0",
        name: "scale",
        price: "15",
        rpm: 180,
        bandwidth: 500_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_cz1JZMI0bfbyR6JDoVNueY8jS3IqSER0W6lZncWHn10/redirect",
        type: "standard",
        regionSelection: true,
        minCacheTtlSeconds: 1,
        concurrencyLimit: 100,
      },
      {
        id: "16e7090c-cb67-4545-ae98-6fdda46df7bf",
        name: "lite-monthly",
        price: "-",
        rpm: 0,
        bandwidth: 0,
        type: "lite",
      },
      {
        id: "cdbc8ce1-465c-43f2-9a93-7bc85fa2091e",
        name: "lite",
        price: "-",
        rpm: 0,
        bandwidth: 0,
        type: "lite",
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_s4YOO0p51PmvoY1xSNazmEFYrN58inVu3fnfW0UPbMZ/redirect",
      },
    ],
  },
  production: {
    products: [
      {
        id: "5bb1ff84-60ef-4ee2-b188-35d1203908a5",
        name: "hobby",
        price: "5",
        rpm: 60,
        bandwidth: 25_000_000_000,
        link: "https://buy.polar.sh/polar_cl_LZVMGvtQccxLnJrQ1Vc1JhRhXGAHpyzACkfAXyY6Xmg",
        type: "standard",
        regionSelection: false,
        minCacheTtlSeconds: 600,
        concurrencyLimit: 5,
      },
      {
        id: "43398e9e-7f95-45e9-88e3-49d4ba3d4b94",
        name: "growth",
        price: "8",
        rpm: 120,
        bandwidth: 100_000_000_000,
        link: "https://buy.polar.sh/polar_cl_Abgv-MARys_rNjEtr4kJWLGh3YkvNNlWlATlCEbMrE4",
        type: "standard",
        regionSelection: true,
        minCacheTtlSeconds: 60,
        concurrencyLimit: 25,
      },
      {
        id: "f4821fff-6471-432b-8885-4ef0cd7b7fd8",
        name: "scale",
        price: "15",
        rpm: 180,
        bandwidth: 500_000_000_000,
        link: "https://buy.polar.sh/polar_cl_LtOUp84qHVmYo0hQ1oj0qdyYsOZ5U6HQNePjUrD6hVM",
        type: "standard",
        regionSelection: true,
        minCacheTtlSeconds: 1,
        concurrencyLimit: 100,
      },
      {
        id: "d6ce3bb4-bd1b-4d71-b020-88f1dc481c1d",
        name: "lite-monthly",
        price: "-",
        rpm: 0,
        bandwidth: 0,
        type: "lite",
      },
      {
        id: "48913e30-5467-4032-8c93-4163e9bd5c5b",
        name: "lite",
        price: "-",
        rpm: 0,
        bandwidth: 0,
        type: "lite",
        link: "https://buy.polar.sh/polar_cl_K9G2lnu5SFjRySFLDVlK9knxW1KShfxrxS5So237ZUg",
      },
    ],
  },
};

interface TrialLimit {
  bytes: number;
  app_count: number;
  rpm: number;
}

export const trialLimit: TrialLimit = {
  bytes: 1_000_000_000,
  app_count: 3,
  rpm: 60,
};

export const config = configList[ENV];
export const IS_CLOUD = process.env.CLOUD === "true";
export const IS_SELFHOST = !IS_CLOUD;
export const DISABLE_SIGNUP = process.env.DISABLE_SIGNUP === "true";
