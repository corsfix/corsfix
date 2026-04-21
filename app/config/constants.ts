const ENV = process.env.NODE_ENV;

export type PlanFamily = "hobby" | "growth" | "scale" | "lite";
export type BillingCycle = "monthly" | "yearly";

export interface Product {
  id: string;
  name: string;
  label: string;
  family: PlanFamily;
  billingCycle: BillingCycle;
  price: string;
  bandwidth: number;
  link?: string;
  type: "standard" | "lite";
  concurrencyLimit?: number;
  benefits?: string[];
  description?: string;
}

interface Config {
  products: Product[];
}

const STANDARD_BENEFITS: Record<PlanFamily, string[]> = {
  hobby: [
    "Unlimited domains",
    "3 concurrent users",
    "60 RPM (per user)",
    "25 GB bandwidth",
    "Caching (min. 10 min)",
    "Secrets variables",
    "All file sizes & types",
    "Global infrastructure",
  ],
  growth: [
    "Everything in Hobby",
    "15 concurrent users",
    "120 RPM (per user)",
    "100 GB bandwidth",
    "Caching (min. 1 min)",
    "Region selection",
  ],
  scale: [
    "Everything in Growth",
    "100 concurrent users",
    "180 RPM (per user)",
    "500 GB bandwidth",
    "Caching (no minimum)",
  ],
  lite: [],
};

const configList: Record<string, Config> = {
  development: {
    products: [
      {
        id: "a31fbaa6-9e5d-4ddf-94d6-7e373a7ddfeb",
        name: "hobby-monthly",
        label: "Hobby",
        family: "hobby",
        billingCycle: "monthly",
        price: "5",
        bandwidth: 25_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_wHdNRksqy8ahDKsr8ZNRRwp3OrBTYbbhmUTF4edt7po/redirect",
        type: "standard",
        concurrencyLimit: 3,
        description: "Perfect for hobby projects",
        benefits: STANDARD_BENEFITS.hobby,
      },
      {
        id: "f8ff1a7d-b4cd-4834-8f0b-0e814adae76d",
        name: "hobby-yearly",
        label: "Hobby",
        family: "hobby",
        billingCycle: "yearly",
        price: "49",
        bandwidth: 25_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_n6TnKRMuutx3ZvVNQu962O3bjUpy5P6bzUBUF196nr9/redirect",
        type: "standard",
        concurrencyLimit: 3,
        description: "Perfect for hobby projects",
        benefits: STANDARD_BENEFITS.hobby,
      },
      {
        id: "46b89204-f1cf-4e12-a84f-bc00efc0fc70",
        name: "growth-monthly",
        label: "Growth",
        family: "growth",
        billingCycle: "monthly",
        price: "9",
        bandwidth: 100_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_EK7Yv6QfrWNqPY6VaabXlBhQN5lgPKPXJqbRP0ayrzt/redirect",
        type: "standard",
        concurrencyLimit: 15,
        description: "Built for growing websites",
        benefits: STANDARD_BENEFITS.growth,
      },
      {
        id: "862c30ef-ff34-43b7-a19c-b262cae89b62",
        name: "growth-yearly",
        label: "Growth",
        family: "growth",
        billingCycle: "yearly",
        price: "89",
        bandwidth: 100_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_zlVrlvR9Y8Y6uiZ2vKtHAHzGdo8y_b1uQNfssoS0Qi0/redirect",
        type: "standard",
        concurrencyLimit: 15,
        description: "Built for growing websites",
        benefits: STANDARD_BENEFITS.growth,
      },
      {
        id: "f6381a0c-71db-4d6e-acaf-ce332bf01fb0",
        name: "scale-monthly",
        label: "Scale",
        family: "scale",
        billingCycle: "monthly",
        price: "19",
        bandwidth: 500_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_cz1JZMI0bfbyR6JDoVNueY8jS3IqSER0W6lZncWHn10/redirect",
        type: "standard",
        concurrencyLimit: 100,
        description: "For websites ready to scale",
        benefits: STANDARD_BENEFITS.scale,
      },
      {
        id: "069bb97f-4e62-4de9-9bed-a7c4bac0ae34",
        name: "scale-yearly",
        label: "Scale",
        family: "scale",
        billingCycle: "yearly",
        price: "189",
        bandwidth: 500_000_000_000,
        link: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_i7OGBKknH2vH4oaQN3WLJqipX10imo8k4JrJc18Wo9b/redirect",
        type: "standard",
        concurrencyLimit: 100,
        description: "For websites ready to scale",
        benefits: STANDARD_BENEFITS.scale,
      },
      {
        id: "cdbc8ce1-465c-43f2-9a93-7bc85fa2091e",
        name: "lite",
        label: "Lite",
        family: "lite",
        billingCycle: "yearly",
        price: "29",
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
        name: "hobby-monthly",
        label: "Hobby",
        family: "hobby",
        billingCycle: "monthly",
        price: "5",
        bandwidth: 25_000_000_000,
        link: "https://buy.polar.sh/polar_cl_LZVMGvtQccxLnJrQ1Vc1JhRhXGAHpyzACkfAXyY6Xmg",
        type: "standard",
        concurrencyLimit: 3,
        description: "Perfect for hobby projects",
        benefits: STANDARD_BENEFITS.hobby,
      },
      {
        id: "5eb6ef9e-4678-48fc-af17-22a8aadc32b6",
        name: "hobby-yearly",
        label: "Hobby",
        family: "hobby",
        billingCycle: "yearly",
        price: "49",
        bandwidth: 25_000_000_000,
        link: "https://buy.polar.sh/polar_cl_z6EiQpMMcnfXqdDq0TJHehIbao9OOP0wCfTdj2xoahB",
        type: "standard",
        concurrencyLimit: 3,
        description: "Perfect for hobby projects",
        benefits: STANDARD_BENEFITS.hobby,
      },
      {
        id: "43398e9e-7f95-45e9-88e3-49d4ba3d4b94",
        name: "growth-monthly",
        label: "Growth",
        family: "growth",
        billingCycle: "monthly",
        price: "9",
        bandwidth: 100_000_000_000,
        link: "https://buy.polar.sh/polar_cl_Abgv-MARys_rNjEtr4kJWLGh3YkvNNlWlATlCEbMrE4",
        type: "standard",
        concurrencyLimit: 15,
        description: "Built for growing websites",
        benefits: STANDARD_BENEFITS.growth,
      },
      {
        id: "5b568f91-a991-4316-a390-6ee013548450",
        name: "growth-yearly",
        label: "Growth",
        family: "growth",
        billingCycle: "yearly",
        price: "89",
        bandwidth: 100_000_000_000,
        link: "https://buy.polar.sh/polar_cl_meubVR5MVyubd1aMytkMWkVGgI60hXeb1jYbs4RUCbp",
        type: "standard",
        concurrencyLimit: 15,
        description: "Built for growing websites",
        benefits: STANDARD_BENEFITS.growth,
      },
      {
        id: "f4821fff-6471-432b-8885-4ef0cd7b7fd8",
        name: "scale-monthly",
        label: "Scale",
        family: "scale",
        billingCycle: "monthly",
        price: "19",
        bandwidth: 500_000_000_000,
        link: "https://buy.polar.sh/polar_cl_LtOUp84qHVmYo0hQ1oj0qdyYsOZ5U6HQNePjUrD6hVM",
        type: "standard",
        concurrencyLimit: 100,
        description: "For websites ready to scale",
        benefits: STANDARD_BENEFITS.scale,
      },
      {
        id: "3612a0ba-0b60-4e98-b1af-892b8c50fc4e",
        name: "scale-yearly",
        label: "Scale",
        family: "scale",
        billingCycle: "yearly",
        price: "189",
        bandwidth: 500_000_000_000,
        link: "https://buy.polar.sh/polar_cl_5oPhkaEs26MHZ7h6sFjPMvehQN1zlr70rub2B1xh8vg",
        type: "standard",
        concurrencyLimit: 100,
        description: "For websites ready to scale",
        benefits: STANDARD_BENEFITS.scale,
      },
      {
        id: "48913e30-5467-4032-8c93-4163e9bd5c5b",
        name: "lite",
        label: "Lite",
        family: "lite",
        billingCycle: "yearly",
        price: "29",
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
