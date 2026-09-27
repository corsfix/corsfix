import { CacheableMemory } from "cacheable";
import dbConnect from "@/lib/dbConnect";
import { OAuthClientEntity } from "@/models/OAuthClientEntity";
import { safeFetch } from "@/lib/safeFetch";
import { allowCall } from "@/lib/rateLimit";
import { validateRedirectUri } from "./redirectUri";
import { TOKEN_PREFIX } from "./crypto";

export type TokenEndpointAuthMethod =
  | "none"
  | "client_secret_basic"
  | "client_secret_post";

export interface OAuthClient {
  client_id: string;
  client_name: string;
  client_uri?: string;
  redirect_uris: string[];
  token_endpoint_auth_method: TokenEndpointAuthMethod;
  client_secret_hash?: string;
  // "metadata_document": the client_id is an HTTPS URL serving its metadata
  // (Client ID Metadata Documents). "registered": created through Dynamic
  // Client Registration.
  source: "metadata_document" | "registered";
}

export class OAuthClientError extends Error {}

const metadataCache = new CacheableMemory({ ttl: "1h", lruSize: 500 });
// Failed lookups are remembered briefly and concurrent lookups of the same
// document share one request, so repeated page loads don't refetch.
const failedMetadataCache = new CacheableMemory({ ttl: "1m", lruSize: 500 });
const pendingMetadata = new Map<string, Promise<OAuthClient>>();

// Documents fetched per signed-in user per minute.
const METADATA_FETCHES_PER_MINUTE = 20;

const MIN_METADATA_TTL_SECONDS = 5 * 60;
const MAX_METADATA_TTL_SECONDS = 24 * 60 * 60;

export const isMetadataDocumentClientId = (clientId: string): boolean =>
  clientId.startsWith("https://");

const cacheTtlSeconds = (cacheControl: string | undefined): number => {
  const maxAge = cacheControl?.match(/max-age=(\d+)/i);
  const seconds = maxAge ? parseInt(maxAge[1], 10) : 60 * 60;
  return Math.min(
    MAX_METADATA_TTL_SECONDS,
    Math.max(MIN_METADATA_TTL_SECONDS, seconds)
  );
};

const optionalHttpsUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

// The URL parser resolves "." and ".." segments, so they are looked for in the
// client_id as sent (including percent-encoded dots).
const hasDotSegment = (clientId: string): boolean => {
  const path = clientId.replace(/^https:\/\/[^/?#]*/i, "").split(/[?#]/)[0];
  return path.split("/").some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment));
};

// Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document):
// the client_id is an HTTPS URL with a path, and no fragment, credentials or
// dot segments.
export const parseMetadataDocumentClientId = (clientId: string): URL => {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    throw new OAuthClientError("client_id is not a valid URL");
  }
  if (
    url.protocol !== "https:" ||
    url.pathname === "/" ||
    url.hash ||
    clientId.includes("#") ||
    url.username ||
    url.password ||
    hasDotSegment(clientId)
  ) {
    throw new OAuthClientError(
      "client_id must be an https URL with a path, and no fragment, credentials or dot segments"
    );
  }
  return url;
};

// The document served at the client_id URL lists the client's name and
// redirect URIs.
async function fetchMetadataDocument(
  clientId: string,
  url: URL
): Promise<OAuthClient> {
  let response;
  try {
    response = await safeFetch(url, {
      headers: { accept: "application/json" },
      timeoutMs: 5_000,
      maxBytes: 16 * 1024,
    });
  } catch (error) {
    throw new OAuthClientError(
      `Could not fetch the client metadata document: ${
        error instanceof Error ? error.message : "request failed"
      }`
    );
  }
  if (response.status !== 200 || response.truncated) {
    throw new OAuthClientError(
      `The client metadata document returned ${
        response.truncated ? "too much data" : `status ${response.status}`
      }`
    );
  }

  let document: Record<string, unknown>;
  try {
    document = JSON.parse(response.body.toString("utf8"));
  } catch {
    throw new OAuthClientError("The client metadata document is not JSON");
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new OAuthClientError("The client metadata document is not an object");
  }
  if (document.client_id !== clientId) {
    throw new OAuthClientError(
      "The client metadata document's client_id does not match its URL"
    );
  }

  const redirectUris = document.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > 20 ||
    redirectUris.some(
      (uri) => typeof uri !== "string" || validateRedirectUri(uri) !== null
    )
  ) {
    throw new OAuthClientError(
      "The client metadata document has missing or invalid redirect_uris"
    );
  }

  // Metadata-document clients are public clients: shared secrets make no
  // sense for a document anyone can read, and private_key_jwt is not
  // supported here.
  const authMethod = document.token_endpoint_auth_method;
  if (authMethod !== undefined && authMethod !== "none") {
    throw new OAuthClientError(
      `token_endpoint_auth_method "${String(
        authMethod
      )}" is not supported; use "none"`
    );
  }

  const name =
    typeof document.client_name === "string" && document.client_name.trim()
      ? document.client_name.trim().slice(0, 100)
      : url.host;

  const client: OAuthClient = {
    client_id: clientId,
    client_name: name,
    client_uri: optionalHttpsUrl(document.client_uri),
    redirect_uris: redirectUris as string[],
    token_endpoint_auth_method: "none",
    source: "metadata_document",
  };

  metadataCache.set(
    clientId,
    client,
    cacheTtlSeconds(response.headers["cache-control"]) * 1000
  );
  return client;
}

// Looks up a client by client_id. Returns null for unknown clients and
// throws OAuthClientError when a metadata document is present but invalid.
//
async function loadMetadataDocument(
  clientId: string,
  url: URL,
  limitKey?: string
): Promise<OAuthClient> {
  const failure = failedMetadataCache.get<string>(clientId);
  if (failure) throw new OAuthClientError(failure);

  const pending = pendingMetadata.get(clientId);
  if (pending) return pending;

  if (
    limitKey &&
    !(await allowCall(
      `oauth:metadata:${limitKey}`,
      METADATA_FETCHES_PER_MINUTE,
      60
    ))
  ) {
    throw new OAuthClientError(
      "Too many apps were looked up in a short time. Wait a minute and try again."
    );
  }

  const request = fetchMetadataDocument(clientId, url)
    .catch((error) => {
      if (error instanceof OAuthClientError) {
        failedMetadataCache.set(clientId, error.message);
      }
      throw error;
    })
    .finally(() => pendingMetadata.delete(clientId));
  pendingMetadata.set(clientId, request);
  return request;
}

// fetchMetadata: false is for the token and revocation endpoints. There a
// metadata-document client is a public client identified by its URL, and the
// codes and tokens it presents are bound to that client_id, so the document
// is not needed. Not fetching it keeps unauthenticated requests from making
// the server call arbitrary URLs.
// limitKey (the signed-in user's id) rate-limits metadata document fetches.
export async function getClient(
  clientId: string,
  {
    fetchMetadata = true,
    limitKey,
  }: { fetchMetadata?: boolean; limitKey?: string } = {}
): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 2048) return null;

  if (isMetadataDocumentClientId(clientId)) {
    const url = parseMetadataDocumentClientId(clientId);
    const cached = metadataCache.get<OAuthClient>(clientId);
    if (cached) return cached;
    if (!fetchMetadata) {
      return {
        client_id: clientId,
        client_name: url.host,
        redirect_uris: [],
        token_endpoint_auth_method: "none",
        source: "metadata_document",
      };
    }
    return loadMetadataDocument(clientId, url, limitKey);
  }

  if (!clientId.startsWith(TOKEN_PREFIX.clientId)) return null;

  await dbConnect();
  const client = await OAuthClientEntity.findById(clientId).lean();
  if (!client || client.expires_at < new Date()) return null;

  return {
    client_id: client._id,
    client_name: client.client_name,
    client_uri: client.client_uri,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method:
      client.token_endpoint_auth_method as TokenEndpointAuthMethod,
    client_secret_hash: client.client_secret_hash,
    source: "registered",
  };
}

// Registered clients expire when unused; any successful authorization or
// refresh keeps them alive.
export async function touchRegisteredClient(
  client: OAuthClient,
  ttlSeconds: number
): Promise<void> {
  if (client.source !== "registered") return;
  await dbConnect();
  await OAuthClientEntity.updateOne(
    { _id: client.client_id },
    { $set: { expires_at: new Date(Date.now() + ttlSeconds * 1000) } }
  );
}
