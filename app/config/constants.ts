const ENV = process.env.NODE_ENV;

export interface Product {
  id: string;
  name: string;
  price: string;
  rpm: number;
  bandwidth: number;
  link?: string;
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
      },
      {
        id: "46b89204-f1cf-4e12-a84f-bc00efc0fc70",
        name: "growth",
        price: "8",
        rpm: 120,
        bandwidth: 100_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_EK7Yv6QfrWNqPY6VaabXlBhQN5lgPKPXJqbRP0ayrzt/redirect",
      },
      {
        id: "f6381a0c-71db-4d6e-acaf-ce332bf01fb0",
        name: "scale",
        price: "15",
        rpm: 180,
        bandwidth: 500_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_cz1JZMI0bfbyR6JDoVNueY8jS3IqSER0W6lZncWHn10/redirect",
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
      },
      {
        id: "43398e9e-7f95-45e9-88e3-49d4ba3d4b94",
        name: "growth",
        price: "8",
        rpm: 120,
        bandwidth: 100_000_000_000,
        link: "https://buy.polar.sh/polar_cl_Abgv-MARys_rNjEtr4kJWLGh3YkvNNlWlATlCEbMrE4",
      },
      {
        id: "f4821fff-6471-432b-8885-4ef0cd7b7fd8",
        name: "scale",
        price: "15",
        rpm: 180,
        bandwidth: 500_000_000_000,
        link: "https://buy.polar.sh/polar_cl_LtOUp84qHVmYo0hQ1oj0qdyYsOZ5U6HQNePjUrD6hVM",
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
