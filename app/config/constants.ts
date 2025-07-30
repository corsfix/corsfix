const ENV = process.env.NODE_ENV;

export interface Product {
  id: string;
  name: string;
  price: string;
  rpm: number;
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
        name: "lite",
        price: "5",
        rpm: 150,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_wHdNRksqy8ahDKsr8ZNRRwp3OrBTYbbhmUTF4edt7po/redirect",
      },
      {
        id: "46b89204-f1cf-4e12-a84f-bc00efc0fc70",
        name: "plus",
        price: "8",
        rpm: 300,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_EK7Yv6QfrWNqPY6VaabXlBhQN5lgPKPXJqbRP0ayrzt/redirect",
      },
      {
        id: "f6381a0c-71db-4d6e-acaf-ce332bf01fb0",
        name: "pro",
        price: "15",
        rpm: 600,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_cz1JZMI0bfbyR6JDoVNueY8jS3IqSER0W6lZncWHn10/redirect",
      },
    ],
  },
  production: {
    products: [
      {
        id: "5bb1ff84-60ef-4ee2-b188-35d1203908a5",
        name: "lite",
        price: "5",
        rpm: 150,
        link: "https://buy.polar.sh/polar_cl_LZVMGvtQccxLnJrQ1Vc1JhRhXGAHpyzACkfAXyY6Xmg",
      },
      {
        id: "43398e9e-7f95-45e9-88e3-49d4ba3d4b94",
        name: "plus",
        price: "8",
        rpm: 300,
        link: "https://buy.polar.sh/polar_cl_Abgv-MARys_rNjEtr4kJWLGh3YkvNNlWlATlCEbMrE4",
      },
      {
        id: "f4821fff-6471-432b-8885-4ef0cd7b7fd8",
        name: "pro",
        price: "15",
        rpm: 600,
        link: "https://buy.polar.sh/polar_cl_LtOUp84qHVmYo0hQ1oj0qdyYsOZ5U6HQNePjUrD6hVM",
      },
    ],
  },
};

export const config = configList[ENV];
export const IS_CLOUD = process.env.CLOUD === "true";
