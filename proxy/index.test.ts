import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { app } from "./app";
import * as apiKeyService from "./lib/services/apiKeyService";
import * as configService from "./lib/config";
import * as metricService from "./lib/services/metricService";

const PORT = 8090;

// Mock getUserByApiKey
vi.spyOn(apiKeyService, "getUserByApiKey").mockImplementation(
  async (apiKey: string) => {
    if (apiKey === "cfx_valid_test_key") {
      return {
        id: "test-user-id",
        subscription_active: true,
        subscription_product_id: "prod_123",
        trial_ends_at: new Date("2099-01-01"),
      };
    }
    return null;
  }
);

// Mock getConfig
vi.spyOn(configService, "getConfig").mockReturnValue({
  products: [
    {
      id: "prod_123",
      name: "Test Product",
      rpm: 1000,
      rateLimitKey: "user_id",
    },
  ],
});

const batchCountMetricsSpy = vi
  .spyOn(metricService, "batchCountMetrics")
  .mockImplementation(() => {});

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
  expect(result.headers.get("X-Corsfix-Status")).toBe("invalid_url");
});

test("invalid url if no tld", async () => {
  const result = await fetch(`http://127.0.0.1:${PORT}/?http://tldless`);
  expect(result.status).toBe(400);
  expect(result.headers.get("X-Corsfix-Status")).toBe("invalid_url");
});

test("invalid if no origin header", async () => {
  const targetUrl = `http://api.test/get`;
  const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`);
  const json = await result.json();
  expect(json.corsfix_error).toBe("invalid_origin");
  expect(json.message).toContain("Origin header");
  expect(result.status).toBe(400);
  expect(result.headers.get("X-Corsfix-Status")).toBe("invalid_origin");
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
  expect(result.headers.get("X-Corsfix-Status")).toBe("preflight");
});

test("proxy request (query string)", async () => {
  const origin = "http://127.0.0.1:3000";
  const targetUrl = `https://httpbin.agrd.workers.dev/get`;

  const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
    headers: {
      Origin: origin,
    },
  });
  expect(result.status).toBe(200);
  expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(result.headers.get("X-Corsfix-Status")).toBe("success");
});

test("proxy request (query param)", async () => {
  const origin = "http://127.0.0.1:3000";
  const targetUrl = `https://httpbin.agrd.workers.dev/get`;

  const result = await fetch(`http://127.0.0.1:${PORT}/?url=${targetUrl}`, {
    headers: {
      Origin: origin,
    },
  });
  expect(result.status).toBe(200);
  expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(result.headers.get("X-Corsfix-Status")).toBe("success");
});

test("proxy request (path)", async () => {
  const origin = "http://127.0.0.1:3000";
  const targetUrl = `https://httpbin.agrd.workers.dev/get`;

  const result = await fetch(`http://127.0.0.1:${PORT}/${targetUrl}`, {
    headers: {
      Origin: origin,
    },
  });
  expect(result.status).toBe(200);
  expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(result.headers.get("X-Corsfix-Status")).toBe("success");
});

test("proxy request with redirect if 3xx", async () => {
  const origin = "http://127.0.0.1:3000";
  const targetUrl = `https://httpbin.agrd.workers.dev/absolute-redirect/1`;

  const result = await fetch(`http://127.0.0.1:${PORT}/${targetUrl}`, {
    headers: {
      Origin: origin,
    },
  });
  expect(result.status).toBe(200);
  expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(result.headers.get("X-Corsfix-Status")).toBe("success");
});

test("proxy request with redirect if 3xx (relative)", async () => {
  const origin = "http://127.0.0.1:3000";
  const targetUrl = `https://httpbin.agrd.workers.dev/redirect/1`;

  const result = await fetch(`http://127.0.0.1:${PORT}/${targetUrl}`, {
    headers: {
      Origin: origin,
    },
  });
  expect(result.status).toBe(200);
  expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(result.headers.get("X-Corsfix-Status")).toBe("success");
});

test("jsonp request", async () => {
  const origin = "http://127.0.0.1:3000";
  const targetUrl = `https://httpbin.agrd.workers.dev/get`;

  const result = await fetch(
    `http://127.0.0.1:${PORT}/?url=${encodeURIComponent(
      targetUrl
    )}&callback=test`,
    {
      headers: {
        Referer: origin,
        "Sec-Fetch-Dest": "script",
      },
    }
  );
  const data = await result.text();

  // Check if it returns the callback function
  expect(data).toMatch(/^test\(/);
  expect(data).toMatch(/\)$/);

  // Check if the JSON object has status 200
  expect(data).toContain('"status":200');
  expect(result.headers.get("X-Corsfix-Status")).toBe("success");
});

test("invalid jsonp request without referer", async () => {
  const targetUrl = `https://httpbin.agrd.workers.dev/get`;

  const result = await fetch(
    `http://127.0.0.1:${PORT}/?url=${encodeURIComponent(
      targetUrl
    )}&callback=test`,
    {
      headers: {
        "Sec-Fetch-Dest": "script",
      },
    }
  );
  const json = await result.json();

  expect(json.corsfix_error).toBe("invalid_referer");
  expect(json.message).toContain("Referer header");
  expect(result.status).toBe(400);
  expect(result.headers.get("X-Corsfix-Status")).toBe("invalid_referer");
});

describe("Metrics counting", () => {
  test("counts metrics for response with Content-Length", async () => {
    batchCountMetricsSpy.mockClear();

    const targetUrl = `https://httpbin.agrd.workers.dev/get`;
    const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
      headers: {
        "x-corsfix-key": "cfx_valid_test_key",
      },
    });
    await result.text();

    expect(result.status).toBe(200);
    expect(batchCountMetricsSpy).toHaveBeenCalledOnce();
  });

  test("counts metrics for response without Content-Length", async () => {
    batchCountMetricsSpy.mockClear();

    const targetUrl = `https://httpbin.agrd.workers.dev/range/1`;
    const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
      headers: {
        "x-corsfix-key": "cfx_valid_test_key",
      },
    });
    await result.text();

    expect(result.status).toBe(200);
    expect(batchCountMetricsSpy).toHaveBeenCalledOnce();
  });
});

describe("API Key authentication", () => {
  test("valid API key succeeds without Origin header", async () => {
    const targetUrl = `https://httpbin.agrd.workers.dev/get`;

    const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
      headers: {
        "x-corsfix-key": "cfx_valid_test_key",
      },
    });

    expect(result.status).toBe(200);
    expect(result.headers.get("X-Corsfix-Status")).toBe("success");
  });

  test("valid API key succeeds with Origin header", async () => {
    const origin = "http://myapp.com";
    const targetUrl = `https://httpbin.agrd.workers.dev/get`;

    const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
      headers: {
        Origin: origin,
        "x-corsfix-key": "cfx_valid_test_key",
      },
    });

    expect(result.status).toBe(200);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(result.headers.get("X-Corsfix-Status")).toBe("success");
  });

  test("preflight with x-corsfix-key in access-control-request-headers succeeds", async () => {
    const origin = "http://myapp.com";
    const targetUrl = `https://httpbin.agrd.workers.dev/get`;

    const result = await fetch(`http://127.0.0.1:${PORT}/?${targetUrl}`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-corsfix-key",
      },
    });

    expect(result.status).toBe(204);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(result.headers.get("Access-Control-Allow-Headers")).toBe("x-corsfix-key");
    expect(result.headers.get("X-Corsfix-Status")).toBe("preflight");
  });
});
