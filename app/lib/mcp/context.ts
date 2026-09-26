import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { Session } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { getUserId } from "@/lib/utils";
import { UserV2Entity } from "@/models/UserV2Entity";

// The signed-in Corsfix account behind an MCP request.
export interface McpAccount {
  // usersv2 _id, used for plan and subscription lookups.
  userId: string;
  // Owner id of applications, secrets and metrics (legacy_id for older
  // accounts), the same value the dashboard gets from getUserId(session).
  ownerId: string;
  email?: string;
  // Public origin of this dashboard (the OAuth issuer).
  issuer: string;
  // A session-shaped object so MCP tools reuse the dashboard's own
  // authorization rules (authorize, getPlanTier, ...).
  session: Session;
}

// Thrown by tools for problems the user or agent can act on. The message is
// returned to the client as a tool error.
export class McpToolError extends Error {}

export interface McpToolContext {
  http?: { authInfo?: AuthInfo };
}

export async function getAccount(ctx: McpToolContext): Promise<McpAccount> {
  const userId = ctx.http?.authInfo?.extra?.userId;
  const issuer = ctx.http?.authInfo?.extra?.issuer;
  if (typeof userId !== "string" || !userId || typeof issuer !== "string") {
    throw new McpToolError("This request is not signed in to Corsfix.");
  }

  await dbConnect();
  const user = await UserV2Entity.findById(userId).lean();
  if (!user) {
    throw new McpToolError(
      "The Corsfix account for this connection no longer exists."
    );
  }

  const session: Session = {
    user: {
      id: user._id.toString(),
      legacy_id: user.legacy_id,
      email: user.email,
      name: user.name,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };

  return {
    userId: user._id.toString(),
    ownerId: getUserId(session),
    email: user.email,
    issuer,
    session,
  };
}

export const jsonResult = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

export const errorResult = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

// Wraps a tool handler so expected problems become tool errors the agent can
// read, and unexpected ones are logged without leaking internals.
export function handleErrors<Args>(
  name: string,
  handler: (args: Args, ctx: McpToolContext) => Promise<CallToolResult>
) {
  return async (args: Args, ctx: McpToolContext): Promise<CallToolResult> => {
    try {
      return await handler(args, ctx);
    } catch (error) {
      if (error instanceof McpToolError) {
        return errorResult(error.message);
      }
      console.error(`MCP tool ${name} failed`, error);
      const dashboard = ctx.http?.authInfo?.extra?.issuer;
      return errorResult(
        `Something went wrong on the Corsfix side. Try again, or use the dashboard${
          typeof dashboard === "string" ? ` at ${dashboard}` : ""
        }.`
      );
    }
  };
}
