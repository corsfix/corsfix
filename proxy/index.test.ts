import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { app } from "./app";

const PORT = 8090;

beforeAll(async () => {
  await app.listen(PORT);
});

afterAll(async () => {
  app.close();
});

test("redirect if root path", async () => {
  const result = await fetch(`http://127.0.0.1:${PORT}`, {
    redirect: "manual",
  });
  expect(result.status).toBe(301);
});

test("invalid url if protocol other than http/https", async () => {
  const result = await fetch(`http://127.0.0.1:${PORT}/?file://myfile`);
  expect(result.status).toBe(400);
});

test("invalid url if no tld", async () => {
  const result = await fetch(`http://127.0.0.1:${PORT}/?http://tldless`);
  expect(result.status).toBe(400);
});

test("invalid if no origin header", async () => {
  const targetUrl = `http://api.test/get`;
  const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`);
  const text = await result.text();
  expect(text).toContain("invalid Origin header");
  expect(result.status).toBe(400);
});

test("return preflight headers if options request", async () => {
  const origin = "http://127.0.0.1:3000";
  const requestMethod = "GET";
  const requestHeaders = "Header1,Header2";

  const targetUrl = `http://api.test/get`;
  const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": requestMethod,
      "Access-Control-Request-Headers": requestHeaders,
    },
  });
  expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(result.headers.get("Access-Control-Allow-Methods")).toBe(
    requestMethod
  );
  expect(result.headers.get("Access-Control-Allow-Headers")).toBe(
    requestHeaders
  );
  expect(result.status).toBe(204);
});

test("basic proxy request", async () => {
  const origin = "http://127.0.0.1:3000";

  const targetUrl = `https://httpbin.agrd.workers.dev/get`;

  const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
    headers: {
      Origin: origin,
    },
  });
  expect(result.status).toBe(200);
});
