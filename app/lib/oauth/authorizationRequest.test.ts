import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./clientService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./clientService")>()),
  getClient: vi.fn(),
}));
vi.mock("@/lib/dbConnect", () => ({ default: vi.fn() }));

import { OAuthClient, OAuthClientError, getClient } from "./clientService";
import {
  AuthorizationParams,
  buildRedirectUrl,
  validateAuthorizationRequest,
} from "./authorizationRequest";

const ISSUER = "https://app.corsfix.com";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const client: OAuthClient = {
  client_id: "cfx_mcp_client_test",
  client_name: "Test client",
  redirect_uris: ["http://127.0.0.1/callback"],
  token_endpoint_auth_method: "none",
  source: "registered",
};

const params = (
  overrides: Partial<AuthorizationParams> = {}
): AuthorizationParams => ({
  client_id: client.client_id,
  redirect_uri: "http://127.0.0.1:41234/callback",
  response_type: "code",
  code_challenge: CHALLENGE,
  code_challenge_method: "S256",
  state: "xyz",
  ...overrides,
});

beforeEach(() => {
  vi.mocked(getClient).mockReset();
  vi.mocked(getClient).mockResolvedValue(client);
});

describe("validateAuthorizationRequest", () => {
  it("accepts a PKCE request and binds it to the MCP resource", async () => {
    const result = await validateAuthorizationRequest(params(), ISSUER);
    expect(result).toEqual({
      ok: true,
      request: {
        client,
        redirectUri: "http://127.0.0.1:41234/callback",
        codeChallenge: CHALLENGE,
        scope: "corsfix",
        resource: `${ISSUER}/mcp`,
        state: "xyz",
      },
    });
  });

  it("uses the only registered redirect URI when none is sent", async () => {
    const result = await validateAuthorizationRequest(
      params({ redirect_uri: undefined }),
      ISSUER
    );
    expect(result.ok && result.request.redirectUri).toBe(
      "http://127.0.0.1/callback"
    );
  });

  it("never redirects for unknown clients or unregistered redirect URIs", async () => {
    vi.mocked(getClient).mockResolvedValueOnce(null);
    expect(await validateAuthorizationRequest(params(), ISSUER)).toMatchObject({
      ok: false,
      redirectUri: null,
      error: "invalid_client",
    });

    vi.mocked(getClient).mockRejectedValueOnce(
      new OAuthClientError("The client metadata document is not JSON")
    );
    expect(await validateAuthorizationRequest(params(), ISSUER)).toMatchObject({
      ok: false,
      redirectUri: null,
      description: "The client metadata document is not JSON",
    });

    expect(
      await validateAuthorizationRequest(
        params({ redirect_uri: "https://evil.example/callback" }),
        ISSUER
      )
    ).toMatchObject({ ok: false, redirectUri: null, error: "invalid_request" });

    expect(
      await validateAuthorizationRequest(
        params({ client_id: undefined }),
        ISSUER
      )
    ).toMatchObject({ ok: false, redirectUri: null });
  });

  it.each([
    [{ response_type: "token" }, "unsupported_response_type"],
    [{ code_challenge: undefined }, "invalid_request"],
    [{ code_challenge_method: "plain" }, "invalid_request"],
    [{ code_challenge: "too-short" }, "invalid_request"],
    [{ resource: "https://other.example/mcp" }, "invalid_target"],
    [{ state: "s".repeat(2049) }, "invalid_request"],
  ] as [Partial<AuthorizationParams>, string][])(
    "reports %o back to the client as %s",
    async (overrides, error) => {
      const result = await validateAuthorizationRequest(
        params(overrides),
        ISSUER
      );
      expect(result).toMatchObject({
        ok: false,
        redirectUri: "http://127.0.0.1:41234/callback",
        error,
      });
    }
  );

  it("always grants the corsfix scope and echoes offline_access", async () => {
    const scopeFor = async (scope?: string) => {
      const result = await validateAuthorizationRequest(
        params({ scope }),
        ISSUER
      );
      return result.ok && result.request.scope;
    };
    expect(await scopeFor(undefined)).toBe("corsfix");
    expect(await scopeFor("admin")).toBe("corsfix");
    expect(await scopeFor("offline_access admin")).toBe(
      "corsfix offline_access"
    );
  });
});

describe("buildRedirectUrl", () => {
  it("adds the parameters and the issuer (RFC 9207)", () => {
    const url = new URL(
      buildRedirectUrl(
        "cursor://anysphere.cursor-retrieval/oauth/callback?x=1",
        ISSUER,
        {
          code: "abc",
          state: "s p",
          error: undefined,
        }
      )
    );
    expect(url.protocol).toBe("cursor:");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      x: "1",
      code: "abc",
      state: "s p",
      iss: ISSUER,
    });
  });
});
