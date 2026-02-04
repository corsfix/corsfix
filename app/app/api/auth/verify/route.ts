import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");

  if (!callbackUrl) {
    return new Response("Invalid verification link.", { status: 400 });
  }

  const decodedUrl = Buffer.from(callbackUrl, "base64").toString("utf-8");

  const html = /*html*/ `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${decodedUrl}">
  <title>Redirecting...</title>
</head>
<body>
  <noscript>
    <p><a href="${decodedUrl}">Click here</a> to continue.</p>
  </noscript>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
