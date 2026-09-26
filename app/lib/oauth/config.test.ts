import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalizeResource, getIssuer } from "./config";

const ISSUER = "https://app.corsfix.com";

describe("canonicalizeResource", () => {
  it("defaults to the MCP endpoint when no resource is sent", () => {
    expect(canonicalizeResource(undefined, ISSUER)).toBe(`${ISSUER}/mcp`);
    expect(canonicalizeResource("", ISSUER)).toBe(`${ISSUER}/mcp`);
  });

  it.each([
    "https://app.corsfix.com/mcp",
    "https://app.corsfix.com/mcp/",
    "https://APP.corsfix.com/mcp",
    "https://app.corsfix.com:443/mcp",
    "https://app.corsfix.com",
    "https://app.corsfix.com/",
  ])("maps %s to the MCP endpoint", (value) => {
    expect(canonicalizeResource(value, ISSUER)).toBe(`${ISSUER}/mcp`);
  });

  it.each([
    "https://evil.example/mcp",
    "http://app.corsfix.com/mcp",
    "https://app.corsfix.com:8443/mcp",
    "https://app.corsfix.com/api/applications",
    "https://app.corsfix.com/mcp?x=1",
    "https://app.corsfix.com/mcp#frag",
    "not a url",
  ])("rejects %s", (value) => {
    expect(canonicalizeResource(value, ISSUER)).toBeNull();
  });
});

describe("getIssuer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers AUTH_URL over request headers", () => {
    vi.stubEnv("AUTH_URL", "https://dash.example.com:443/api/auth");
    const headers = new Headers({ host: "attacker.example" });
    expect(getIssuer(headers)).toBe("https://dash.example.com");
  });

  it("falls back to forwarded headers, then the Host header", () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    expect(
      getIssuer(
        new Headers({
          host: "internal:3000",
          "x-forwarded-host": "app.example.com",
          "x-forwarded-proto": "https",
        })
      )
    ).toBe("https://app.example.com");
    expect(getIssuer(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000"
    );
    expect(getIssuer(new Headers({ host: "app.example.com" }))).toBe(
      "https://app.example.com"
    );
  });
});
