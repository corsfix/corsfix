import crypto from "crypto";

// Tokens and codes are random 256-bit values with a recognizable prefix (so
// secret scanners and humans can tell them apart). Only their SHA-256 hashes
// are stored.
export const TOKEN_PREFIX = {
  accessToken: "cfx_mcp_at_",
  refreshToken: "cfx_mcp_rt_",
  authorizationCode: "cfx_mcp_ac_",
  clientId: "cfx_mcp_client_",
  clientSecret: "cfx_mcp_cs_",
} as const;

export const randomToken = (prefix: string, bytes = 32): string =>
  `${prefix}${crypto.randomBytes(bytes).toString("base64url")}`;

export const hashToken = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

export const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return (
    bufferA.length === bufferB.length &&
    crypto.timingSafeEqual(bufferA, bufferB)
  );
};

// RFC 7636: code_verifier is 43-128 unreserved characters, and the S256
// challenge is BASE64URL(SHA256(verifier)).
export const isValidCodeVerifier = (verifier: string): boolean =>
  /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);

export const isValidCodeChallenge = (challenge: string): boolean =>
  /^[A-Za-z0-9\-_]{43}$/.test(challenge);

export const verifyPkceS256 = (
  verifier: string,
  challenge: string
): boolean => {
  if (!isValidCodeVerifier(verifier)) return false;
  const computed = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return safeEqual(computed, challenge);
};
