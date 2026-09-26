import { describe, expect, it } from "vitest";
import {
  redirectDisplayTarget,
  redirectUriMatches,
  validateRedirectUri,
} from "./redirectUri";

describe("validateRedirectUri", () => {
  it.each([
    "https://claude.ai/api/mcp/auth_callback",
    "https://example.com/callback?client=1",
    "http://localhost:33418/callback",
    "http://127.0.0.1/callback",
    "http://[::1]:8080/cb",
    "cursor://anysphere.cursor-retrieval/oauth/callback",
    "vscode://vscode.github-authentication/did-authenticate",
    "com.example.app:/oauth2redirect",
  ])("accepts %s", (uri) => {
    expect(validateRedirectUri(uri)).toBeNull();
  });

  it.each([
    ["http://example.com/callback", "must use https"],
    ["http://localhost.evil.com/callback", "must use https"],
    ["http://127.0.0.1.nip.io/callback", "must use https"],
    ["https://example.com/callback#fragment", "fragment"],
    ["javascript:alert(1)", "javascript:"],
    ["data:text/html,hi", "data:"],
    ["file:///etc/passwd", "file:"],
    ["blob:https://example.com/uuid", "blob:"],
    ["not a url", "not a valid URL"],
    ["", "at most 2048"],
    [`https://example.com/${"a".repeat(2100)}`, "at most 2048"],
  ])("rejects %s", (uri, problem) => {
    expect(validateRedirectUri(uri)).toContain(problem);
  });
});

describe("redirectUriMatches", () => {
  it("matches identical URIs", () => {
    expect(
      redirectUriMatches("https://app.example/cb", "https://app.example/cb")
    ).toBe(true);
  });

  it("lets loopback redirects use any port (RFC 8252 7.3)", () => {
    expect(
      redirectUriMatches("http://127.0.0.1/cb", "http://127.0.0.1:51234/cb")
    ).toBe(true);
    expect(
      redirectUriMatches("http://localhost:3000/cb", "http://localhost:4000/cb")
    ).toBe(true);
  });

  it("keeps host, path and query strict for loopback redirects", () => {
    expect(
      redirectUriMatches("http://localhost:3000/cb", "http://127.0.0.1:3000/cb")
    ).toBe(false);
    expect(
      redirectUriMatches("http://localhost/cb", "http://localhost:4000/other")
    ).toBe(false);
    expect(
      redirectUriMatches(
        "http://localhost/cb?a=1",
        "http://localhost:4000/cb?a=2"
      )
    ).toBe(false);
  });

  it("does not relax ports for https redirects", () => {
    expect(
      redirectUriMatches(
        "https://app.example/cb",
        "https://app.example:8443/cb"
      )
    ).toBe(false);
  });

  it("rejects different https URIs and garbage", () => {
    expect(
      redirectUriMatches("https://app.example/cb", "https://evil.example/cb")
    ).toBe(false);
    expect(redirectUriMatches("https://app.example/cb", "nonsense")).toBe(
      false
    );
  });
});

describe("redirectDisplayTarget", () => {
  it("shows the host for web redirects and the scheme for app redirects", () => {
    expect(
      redirectDisplayTarget("https://claude.ai/api/mcp/auth_callback")
    ).toBe("claude.ai");
    expect(redirectDisplayTarget("http://127.0.0.1:5173/cb")).toBe(
      "127.0.0.1:5173"
    );
    expect(
      redirectDisplayTarget(
        "cursor://anysphere.cursor-retrieval/oauth/callback"
      )
    ).toBe("cursor://anysphere.cursor-retrieval");
  });
});
