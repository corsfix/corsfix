import { NextRequest } from "next/server";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCallbackUrl(encoded: string, baseUrl: string): string | null {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const parsed = new URL(decoded, baseUrl);
    return parsed.origin === baseUrl ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const safeUrl = callbackUrl && parseCallbackUrl(callbackUrl, request.nextUrl.origin);

  if (!safeUrl) {
    return new Response("Invalid verification link.", { status: 400 });
  }

  const url = escapeHtml(safeUrl);

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${url}">
  <title>Redirecting...</title>
</head>
<body>
  <noscript>
    <p><a href="${url}">Click here</a> to continue.</p>
  </noscript>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
