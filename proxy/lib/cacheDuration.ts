const DEFAULT_CACHE_SECONDS = 3600; // 1 hour
const MAX_CACHE_SECONDS = 86400; // 1 day

export function parseCacheDuration(value: string): number {
  const match = value.trim().match(/^(\d+)(s|m|h|d)?$/i);
  if (!match) return DEFAULT_CACHE_SECONDS;

  const num = parseInt(match[1], 10);
  if (num <= 0) return DEFAULT_CACHE_SECONDS;

  const unit = (match[2] || "s").toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  const seconds = num * multipliers[unit];
  return Math.min(seconds, MAX_CACHE_SECONDS);
}
