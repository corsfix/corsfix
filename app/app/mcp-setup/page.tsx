import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Bot, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import Nav from "@/components/nav";
import {
  McpClientInstructions,
  McpConnection,
  McpConnections,
  McpServerUrl,
} from "@/components/mcp-setup";
import { getIssuer, getMcpResource } from "@/lib/oauth/config";
import { listGrants } from "@/lib/oauth/tokenService";

export const metadata: Metadata = {
  title: "MCP | Corsfix Dashboard",
};

const TOOLS = [
  [
    "check_cors",
    "Checks whether a request from your website will be blocked by CORS, and why",
  ],
  [
    "create_application, update_application",
    "Registers your website's domains and the APIs it may call",
  ],
  [
    "set_secret",
    "Stores API keys so requests use {{NAME}} instead of shipping the key",
  ],
  [
    "generate_snippet",
    "Writes the fetch, SDK, axios or jQuery code for your request",
  ],
  [
    "test_request, test_write_request",
    "Sends a real request through the proxy, like the playground",
  ],
  [
    "get_usage, get_account",
    "Shows traffic, plan limits and the proxy URL to use",
  ],
];

export default async function McpSetupPage() {
  const session = await auth();
  const serverUrl = getMcpResource(getIssuer(await headers()));

  let connections: McpConnection[] = [];
  try {
    if (session?.user?.id) {
      connections = (await listGrants(session.user.id)).map((grant) => ({
        id: grant.id,
        clientName: grant.clientName,
        clientUri: grant.clientUri,
        createdAt: grant.createdAt.toISOString(),
        lastUsedAt: grant.lastUsedAt.toISOString(),
      }));
    }
  } catch (error) {
    console.error("Failed to load MCP connections", error);
  }

  return (
    <>
      <Nav />
      <div className="p-4 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-4 inline-flex items-center">
            <Bot size={28} className="mr-2" />
            MCP
          </h1>
          <p className="text-muted-foreground mb-1 max-w-2xl">
            Connect AI apps such as Claude, ChatGPT, Cursor and VS Code to
            Corsfix. They can diagnose CORS errors, set up your applications and
            secrets, and test requests for you. They sign in with your Corsfix
            account, and you approve each app.
          </p>
          <Link
            href="https://corsfix.com/docs/mcp"
            target="_blank"
            className="inline-block text-violet-500 hover:text-secondary-foreground transition-colors underline"
          >
            MCP documentation <ExternalLink size={24} className="inline pb-1" />
          </Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Server URL</h2>
          <McpServerUrl url={serverUrl} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Add it to your AI app</h2>
          <McpClientInstructions url={serverUrl} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What it can do</h2>
          <ul className="space-y-1.5 text-sm max-w-2xl">
            {TOOLS.map(([names, description]) => (
              <li key={names}>
                <code className="text-xs">{names}</code>
                <span className="text-muted-foreground">: {description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Connected apps</h2>
          <McpConnections initialConnections={connections} />
        </section>
      </div>
    </>
  );
}
