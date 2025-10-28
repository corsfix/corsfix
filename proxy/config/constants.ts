import "dotenv/config";

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

export const IS_CLOUD = process.env.CLOUD === "true";
export const IS_SELFHOST = !IS_CLOUD;
