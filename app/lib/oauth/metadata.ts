import {
  OAUTH_SCOPE,
  PROTECTED_RESOURCE_METADATA_PATH,
  SCOPES_SUPPORTED,
  getMcpResource,
} from "./config";

// RFC 8414 authorization server metadata.
export const authorizationServerMetadata = (issuer: string) => ({
  issuer,
  authorization_endpoint: `${issuer}/oauth/authorize`,
  token_endpoint: `${issuer}/api/oauth/token`,
  registration_endpoint: `${issuer}/api/oauth/register`,
  revocation_endpoint: `${issuer}/api/oauth/revoke`,
  scopes_supported: SCOPES_SUPPORTED,
  response_types_supported: ["code"],
  response_modes_supported: ["query"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: [
    "none",
    "client_secret_basic",
    "client_secret_post",
  ],
  revocation_endpoint_auth_methods_supported: [
    "none",
    "client_secret_basic",
    "client_secret_post",
  ],
  client_id_metadata_document_supported: true,
  authorization_response_iss_parameter_supported: true,
  service_documentation: "https://corsfix.com/docs",
});

// RFC 9728 protected resource metadata for the MCP endpoint.
export const protectedResourceMetadata = (issuer: string) => ({
  resource: getMcpResource(issuer),
  authorization_servers: [issuer],
  // The resource's own scope. offline_access is a token-lifetime scope, so it
  // is only listed in the authorization server metadata.
  scopes_supported: [OAUTH_SCOPE],
  bearer_methods_supported: ["header"],
  resource_name: "Corsfix",
  resource_documentation: "https://corsfix.com/docs/mcp",
});

export const protectedResourceMetadataUrl = (issuer: string) =>
  `${issuer}${PROTECTED_RESOURCE_METADATA_PATH}`;
