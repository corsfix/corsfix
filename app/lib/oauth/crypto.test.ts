import { describe, expect, it } from "vitest";
import {
  TOKEN_PREFIX,
  hashToken,
  isValidCodeChallenge,
  isValidCodeVerifier,
  randomToken,
  safeEqual,
  verifyPkceS256,
} from "./crypto";

// RFC 7636 appendix B.
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("PKCE S256", () => {
  it("accepts the RFC 7636 example", () => {
    expect(verifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true);
  });

  it("rejects a verifier that does not match the challenge", () => {
    expect(verifyPkceS256(`${RFC_VERIFIER.slice(0, -1)}A`, RFC_CHALLENGE)).toBe(
      false
    );
  });

  it("rejects verifiers outside 43-128 unreserved characters", () => {
    expect(isValidCodeVerifier("a".repeat(42))).toBe(false);
    expect(isValidCodeVerifier("a".repeat(129))).toBe(false);
    expect(isValidCodeVerifier(`${"a".repeat(42)}+`)).toBe(false);
    expect(isValidCodeVerifier("a".repeat(43))).toBe(true);
    expect(verifyPkceS256("short", RFC_CHALLENGE)).toBe(false);
  });

  it("only accepts base64url SHA-256 challenges", () => {
    expect(isValidCodeChallenge(RFC_CHALLENGE)).toBe(true);
    expect(isValidCodeChallenge(`${RFC_CHALLENGE}=`)).toBe(false);
    expect(isValidCodeChallenge(RFC_CHALLENGE.replace("-", "+"))).toBe(false);
    expect(isValidCodeChallenge("plain-challenge")).toBe(false);
  });
});

describe("tokens", () => {
  it("creates prefixed, unique random tokens", () => {
    const a = randomToken(TOKEN_PREFIX.accessToken);
    const b = randomToken(TOKEN_PREFIX.accessToken);
    expect(a.startsWith("cfx_mcp_at_")).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBe("cfx_mcp_at_".length + 43);
  });

  it("hashes tokens with SHA-256", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("compares strings of any length safely", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("secret", "secret-longer")).toBe(false);
  });
});
