import { NextRequest } from "next/server";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodePath(encoded: string): string | null {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    return decoded.startsWith("/api/auth/callback/") ? decoded : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const encodedPath = request.nextUrl.searchParams.get("path");
  const safeUrl = encodedPath && decodePath(encodedPath);

  if (!safeUrl) {
    return new Response("Invalid verification link.", { status: 400 });
  }

  const htmlUrl = escapeHtml(safeUrl);
  const jsUrl = JSON.stringify(safeUrl);

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
</head>
<body>
  <noscript>
    <p><a href="${htmlUrl}">Click here</a> to continue.</p>
  </noscript>
  <script>window.location.href = ${jsUrl};</script>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
