import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));
vi.mock("@/lib/dbConnect", () => ({ default: vi.fn() }));
vi.mock("@/models/OAuthClientEntity", () => ({
  OAuthClientEntity: { findById: vi.fn(), updateOne: vi.fn() },
}));

import { safeFetch } from "@/lib/safeFetch";
import { OAuthClientEntity } from "@/models/OAuthClientEntity";
import {
  OAuthClientError,
  getClient,
  parseMetadataDocumentClientId,
} from "./clientService";
import { redirectUriMatches } from "./redirectUri";

const fetchMock = vi.mocked(safeFetch);

let counter = 0;
// Each test uses its own client_id so the in-memory metadata cache does not
// carry results between tests.
const nextClientId = () =>
  `https://client${++counter}.example.com/oauth/metadata.json`;

const respond = (
  body: unknown,
  {
    status = 200,
    headers = {} as Record<string, string>,
    truncated = false,
  } = {}
) =>
  fetchMock.mockResolvedValueOnce({
    status,
    headers,
    truncated,
    body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
  });

beforeEach(() => {
  fetchMock.mockReset();
});

describe("parseMetadataDocumentClientId", () => {
  it("accepts an https URL with a path", () => {
    expect(
      parseMetadataDocumentClientId(
        "https://claude.ai/oauth/mcp-oauth-client-metadata"
      ).host
    ).toBe("claude.ai");
  });

  it.each([
    "https://example.com",
    "https://example.com/",
    "https://example.com/client#frag",
    "https://example.com/client#",
    "https://user:pass@example.com/client",
    "https://example.com/a/../client",
    "https://example.com/./client",
    "https://example.com/a/%2e%2e/client",
    "https://example.com/a/.%2E/client",
  ])("rejects %s", (clientId) => {
    expect(() => parseMetadataDocumentClientId(clientId)).toThrow(
      OAuthClientError
    );
  });
});

describe("getClient with Client ID Metadata Documents", () => {
  it("loads and caches a valid document", async () => {
    const clientId = nextClientId();
    respond(
      {
        client_id: clientId,
        client_name: "  Example Agent  ",
        client_uri: "https://client.example.com",
        redirect_uris: [
          "http://127.0.0.1/callback",
          "https://client.example.com/cb",
        ],
        token_endpoint_auth_method: "none",
      },
      { headers: { "cache-control": "max-age=600" } }
    );

    const client = await getClient(clientId);
    expect(client).toEqual({
      client_id: clientId,
      client_name: "Example Agent",
      client_uri: "https://client.example.com/",
      redirect_uris: [
        "http://127.0.0.1/callback",
        "https://client.example.com/cb",
      ],
      token_endpoint_auth_method: "none",
      source: "metadata_document",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ maxBytes: 16 * 1024 });

    await getClient(clientId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts Claude Code's published document and its per-session port", async () => {
    // As served at https://claude.ai/oauth/claude-code-client-metadata
    const clientId = "https://claude.ai/oauth/claude-code-client-metadata";
    respond({
      client_id: clientId,
      client_name: "Claude Code",
      client_uri: "https://claude.ai",
      redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });

    const client = await getClient(clientId);
    expect(client?.client_name).toBe("Claude Code");
    for (const redirect of [
      "http://localhost:3118/callback",
      "http://127.0.0.1:50123/callback",
    ]) {
      expect(
        client?.redirect_uris.some((uri) => redirectUriMatches(uri, redirect))
      ).toBe(true);
    }
  });

  it("falls back to the host when the document has no name", async () => {
    const clientId = nextClientId();
    respond({ client_id: clientId, redirect_uris: ["https://a.example/cb"] });
    expect((await getClient(clientId))?.client_name).toBe(
      new URL(clientId).host
    );
  });

  it.each([
    [
      "a mismatched client_id",
      (id: string) => ({
        client_id: `${id}x`,
        redirect_uris: ["https://a.example/cb"],
      }),
      "does not match",
    ],
    [
      "no redirect URIs",
      (id: string) => ({ client_id: id, redirect_uris: [] }),
      "redirect_uris",
    ],
    [
      "a javascript: redirect URI",
      (id: string) => ({
        client_id: id,
        redirect_uris: ["javascript:alert(1)"],
      }),
      "redirect_uris",
    ],
    [
      "an http redirect URI",
      (id: string) => ({
        client_id: id,
        redirect_uris: ["http://a.example/cb"],
      }),
      "redirect_uris",
    ],
    [
      "a client secret auth method",
      (id: string) => ({
        client_id: id,
        redirect_uris: ["https://a.example/cb"],
        token_endpoint_auth_method: "client_secret_basic",
      }),
      "not supported",
    ],
    ["an array body", () => [], "not an object"],
  ])("rejects a document with %s", async (_label, build, message) => {
    const clientId = nextClientId();
    respond(build(clientId));
    await expect(getClient(clientId)).rejects.toThrow(message);
  });

  it("rejects non-200, oversized and non-JSON responses", async () => {
    let clientId = nextClientId();
    respond({}, { status: 404 });
    await expect(getClient(clientId)).rejects.toThrow("status 404");

    clientId = nextClientId();
    respond({}, { truncated: true });
    await expect(getClient(clientId)).rejects.toThrow("too much data");

    clientId = nextClientId();
    respond("<html>");
    await expect(getClient(clientId)).rejects.toThrow("not JSON");
  });

  it("reports fetch failures as client errors", async () => {
    const clientId = nextClientId();
    fetchMock.mockRejectedValueOnce(
      new Error("client1.example.com does not resolve to a public address")
    );
    await expect(getClient(clientId)).rejects.toThrow(OAuthClientError);
  });

  it("does not fetch the document when fetchMetadata is false", async () => {
    const clientId = nextClientId();
    const client = await getClient(clientId, { fetchMetadata: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client).toMatchObject({
      client_id: clientId,
      token_endpoint_auth_method: "none",
      source: "metadata_document",
      redirect_uris: [],
    });
  });
});

describe("getClient with registered clients", () => {
  it("ignores client IDs this server did not issue", async () => {
    expect(await getClient("some-other-client")).toBeNull();
    expect(await getClient("")).toBeNull();
    expect(OAuthClientEntity.findById).not.toHaveBeenCalled();
  });
});
