"use client";

import { useState } from "react";
import { Check, Copy, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";

export interface McpConnection {
  id: string;
  clientName: string;
  clientUri?: string;
  createdAt: string;
  lastUsedAt: string;
}

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto text-sm w-full border px-3 py-3 rounded-lg bg-muted/30">
    <code>{children}</code>
  </pre>
);

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy. Select the URL and copy it instead.");
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function McpServerUrl({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 max-w-2xl">
      <code className="text-sm flex-1 break-all">{url}</code>
      <CopyButton value={url} />
    </div>
  );
}

export function McpClientInstructions({ url }: { url: string }) {
  return (
    <Tabs defaultValue="claude" className="max-w-2xl">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="claude">Claude</TabsTrigger>
        <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
        <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
        <TabsTrigger value="cursor">Cursor</TabsTrigger>
        <TabsTrigger value="vscode">VS Code</TabsTrigger>
        <TabsTrigger value="other">Other</TabsTrigger>
      </TabsList>
      <TabsContent value="claude" className="space-y-2 text-sm">
        <p>
          In Claude, open <strong>Customize → Connectors</strong>, choose{" "}
          <strong>Add custom connector</strong>, name it Corsfix and paste the
          server URL. Then click <strong>Connect</strong> and allow access.
        </p>
      </TabsContent>
      <TabsContent value="claude-code" className="space-y-2 text-sm">
        <p>Add the server, then run /mcp in Claude Code to sign in:</p>
        <Code>{`claude mcp add --transport http corsfix ${url}`}</Code>
      </TabsContent>
      <TabsContent value="chatgpt" className="space-y-2 text-sm">
        <p>
          In ChatGPT, turn on developer mode in{" "}
          <strong>Settings → Apps → Advanced settings</strong>, then choose{" "}
          <strong>Create</strong>, paste the server URL, pick OAuth and sign in
          when asked.
        </p>
      </TabsContent>
      <TabsContent value="cursor" className="space-y-2 text-sm">
        <p>
          Add this to <code>~/.cursor/mcp.json</code>, then click{" "}
          <strong>Connect</strong> next to Corsfix in Cursor&apos;s MCP
          settings:
        </p>
        <Code>
          {JSON.stringify({ mcpServers: { corsfix: { url } } }, null, 2)}
        </Code>
      </TabsContent>
      <TabsContent value="vscode" className="space-y-2 text-sm">
        <p>
          Add this to <code>.vscode/mcp.json</code> in your project and start
          the server from the file:
        </p>
        <Code>
          {JSON.stringify(
            { servers: { corsfix: { type: "http", url } } },
            null,
            2
          )}
        </Code>
      </TabsContent>
      <TabsContent value="other" className="space-y-2 text-sm">
        <p>
          Any client that supports remote MCP servers over Streamable HTTP with
          OAuth can use the server URL directly. For clients that only run local
          (stdio) servers, use the mcp-remote bridge:
        </p>
        <Code>{`npx -y mcp-remote ${url}`}</Code>
      </TabsContent>
    </Tabs>
  );
}

export function McpConnections({
  initialConnections,
}: {
  initialConnections: McpConnection[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [pending, setPending] = useState<string | null>(null);

  const disconnect = async (connection: McpConnection) => {
    setPending(connection.id);
    try {
      const result = await apiClient.delete<null>(
        `/oauth/grants/${connection.id}`
      );
      if (!result.success) {
        toast.error(result.message || "Could not disconnect the app.");
        return;
      }
      setConnections((current) =>
        current.filter((item) => item.id !== connection.id)
      );
      toast.success(`Disconnected ${connection.clientName}`);
    } catch {
      toast.error("Could not disconnect the app.");
    } finally {
      setPending(null);
    }
  };

  if (connections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No apps are connected yet. Once you add Corsfix to an AI app and allow
        access, it shows up here.
      </p>
    );
  }

  return (
    <ul className="divide-y border rounded-lg max-w-2xl">
      {connections.map((connection) => (
        <li
          key={connection.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="font-medium truncate">{connection.clientName}</p>
            <p className="text-xs text-muted-foreground">
              Connected {formatDate(connection.createdAt)} · Last used{" "}
              {formatDate(connection.lastUsedAt)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending === connection.id}
            onClick={() => disconnect(connection)}
          >
            <Unplug className="size-4" />
            Disconnect
          </Button>
        </li>
      ))}
    </ul>
  );
}
