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

const parseRPM = (value: string | undefined): number => {
  if (!value) return 180;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed <= 0 ? 180 : parsed;
};

export const SELFHOST_RPM = parseRPM(process.env.RPM);

export const TEXT_ONLY_HOSTNAME = process.env.TEXT_ONLY_HOSTNAME;

export const DEFAULT_PROXY_HOSTNAME = process.env.DEFAULT_PROXY_HOSTNAME;
