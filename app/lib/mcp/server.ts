import type { McpServer } from "@modelcontextprotocol/server";
import { registerAccountTools } from "./tools/account";
import { registerApplicationTools } from "./tools/applications";
import { registerDeveloperTools } from "./tools/developer";
import { registerSecretTools } from "./tools/secrets";

export const SERVER_INFO = { name: "corsfix", version: "1.0.0" };

export const SERVER_INSTRUCTIONS = `Corsfix is a CORS proxy. Browser code that is blocked by CORS calls https://proxy.corsfix.com/?<target URL> (or the Corsfix SDK's corsfix.fetch) and gets the response back with CORS headers added.

Typical workflow:
1. check_cors confirms a request from a website is blocked and explains why.
2. create_application registers the website's domain so it can use the proxy in production (localhost works without this).
3. set_secret stores API keys; requests reference them as {{NAME}} so keys never ship in frontend code.
4. generate_snippet writes the code; test_request (GET/HEAD) and test_write_request (POST/PUT/PATCH/DELETE) send a real request through the proxy to verify it.
5. get_usage and get_account show traffic and plan limits.

Free-tier websites must use the Corsfix SDK. Docs: https://corsfix.com/docs`;

export function registerCorsfixTools(server: McpServer) {
  registerDeveloperTools(server);
  registerApplicationTools(server);
  registerSecretTools(server);
  registerAccountTools(server);
}
