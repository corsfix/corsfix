import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import corsfix, { CorsfixError } from "./index.js";

const PROXY = "https://proxy.corsfix.com/?";

const proxyResponse = (body, { status = 200, corsfixStatus = "success" } = {}) =>
  new Response(body, {
    status,
    headers: { "x-corsfix-status": corsfixStatus },
  });

const proxyError = (code, status, extra = {}) =>
  proxyResponse(
    JSON.stringify({
      corsfix_error: code,
      message: `msg for ${code}`,
      if_you_are_admin: "admin hint",
      if_you_are_user: "user hint",
      ...extra,
    }),
    { status, corsfixStatus: code }
  );

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async () => proxyResponse("ok"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1);
  return { url, init, headers: init.headers };
};

describe("url handling", () => {
  test("prefixes a string URL with the proxy", async () => {
    await corsfix.fetch("https://example.com/api?x=1");
    expect(lastCall().url).toBe(`${PROXY}https://example.com/api?x=1`);
  });

  test("accepts a URL object", async () => {
    await corsfix.fetch(new URL("https://example.com/a?b=2"));
    expect(lastCall().url).toBe(`${PROXY}https://example.com/a?b=2`);
  });
});

describe("proxy url", () => {
  test("uses proxy.corsfix.com by default", async () => {
    await corsfix.fetch("https://example.com");
    expect(lastCall().url).toBe(`${PROXY}https://example.com`);
  });

  test("uses a custom proxy origin", async () => {
    await corsfix.fetch("https://example.com", {
      corsfix: { proxyUrl: "https://proxy-eu.corsfix.com" },
    });
    expect(lastCall().url).toBe("https://proxy-eu.corsfix.com/?https://example.com");
  });

  test("tolerates a trailing slash on the proxy origin", async () => {
    await corsfix.fetch("https://example.com", {
      corsfix: { proxyUrl: "http://localhost:8080/" },
    });
    expect(lastCall().url).toBe("http://localhost:8080/?https://example.com");
  });
});

describe("Request input", () => {
  test("proxies the Request's URL and carries its method, headers and body", async () => {
    const req = new Request("https://example.com/post", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "payload",
    });

    await corsfix.fetch(req);

    const { url: sent, headers } = lastCall();
    expect(sent).toBeInstanceOf(Request);
    expect(sent.url).toBe(`${PROXY}https://example.com/post`);
    expect(sent.method).toBe("POST");
    expect(await sent.text()).toBe("payload");
    expect(headers.get("content-type")).toBe("text/plain");
  });

  test("adds corsfix headers on top of the Request's own headers", async () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer t" },
    });

    await corsfix.fetch(req, { corsfix: { cache: "1h", apiKey: "cfx_k" } });

    const { headers } = lastCall();
    expect(headers.get("authorization")).toBe("Bearer t");
    expect(headers.get("x-corsfix-cache")).toBe("1h");
    expect(headers.get("x-corsfix-key")).toBe("cfx_k");
  });

  test("init.headers replaces the Request's headers, like native fetch", async () => {
    const req = new Request("https://example.com", {
      headers: { "X-From-Request": "1" },
    });

    await corsfix.fetch(req, { headers: { "X-From-Init": "2" } });

    const { headers } = lastCall();
    expect(headers.get("x-from-init")).toBe("2");
    expect(headers.get("x-from-request")).toBeNull();
  });

  test("honours a custom proxyUrl with a Request input", async () => {
    await corsfix.fetch(new Request("https://example.com"), {
      corsfix: { proxyUrl: "https://lite.corsfix.com" },
    });
    // Request normalizes its URL, so the target ends with a slash.
    expect(lastCall().url.url).toBe("https://lite.corsfix.com/?https://example.com/");
  });
});

describe("request options", () => {
  test("passes method and body through to fetch", async () => {
    await corsfix.fetch("https://example.com", {
      method: "POST",
      body: '{"a":1}',
    });
    const { init } = lastCall();
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
  });

  test("preserves caller headers given as a plain object", async () => {
    await corsfix.fetch("https://example.com", {
      headers: { "Content-Type": "application/json" },
    });
    expect(lastCall().headers.get("content-type")).toBe("application/json");
  });

  test("preserves caller headers given as a Headers instance", async () => {
    await corsfix.fetch("https://example.com", {
      headers: new Headers({ Authorization: "Bearer t" }),
    });
    expect(lastCall().headers.get("authorization")).toBe("Bearer t");
  });

  test("preserves caller headers given as tuples", async () => {
    await corsfix.fetch("https://example.com", {
      headers: [["X-A", "1"]],
    });
    expect(lastCall().headers.get("x-a")).toBe("1");
  });

  test("works with no options at all", async () => {
    await corsfix.fetch("https://example.com");
    const { headers } = lastCall();
    expect(headers).toBeInstanceOf(Headers);
    expect([...headers.keys()]).toEqual([]);
  });
});

describe("corsfix options", () => {
  test("sets x-corsfix-cache when cache is true", async () => {
    await corsfix.fetch("https://example.com", { corsfix: { cache: true } });
    expect(lastCall().headers.get("x-corsfix-cache")).toBe("true");
  });

  test("does not set x-corsfix-cache when cache is false or absent", async () => {
    await corsfix.fetch("https://example.com", { corsfix: { cache: false } });
    expect(lastCall().headers.get("x-corsfix-cache")).toBeNull();

    await corsfix.fetch("https://example.com", {});
    expect(lastCall().headers.get("x-corsfix-cache")).toBeNull();
  });

  test("sends a cache duration string as-is", async () => {
    await corsfix.fetch("https://example.com", { corsfix: { cache: "10m" } });
    expect(lastCall().headers.get("x-corsfix-cache")).toBe("10m");
  });

  test("sends a numeric cache value as seconds", async () => {
    await corsfix.fetch("https://example.com", { corsfix: { cache: 30 } });
    expect(lastCall().headers.get("x-corsfix-cache")).toBe("30");
  });

  test("sends the API key as x-corsfix-key", async () => {
    await corsfix.fetch("https://example.com", {
      corsfix: { apiKey: "cfx_abc" },
    });
    expect(lastCall().headers.get("x-corsfix-key")).toBe("cfx_abc");
  });

  test("does not send x-corsfix-key when no API key is given", async () => {
    await corsfix.fetch("https://example.com", { corsfix: { cache: true } });
    expect(lastCall().headers.get("x-corsfix-key")).toBeNull();
  });

  test("serializes custom headers into x-corsfix-headers", async () => {
    await corsfix.fetch("https://example.com", {
      corsfix: { headers: { "X-Custom": "v", Authorization: "Bearer k" } },
    });
    const raw = lastCall().headers.get("x-corsfix-headers");
    expect(JSON.parse(raw)).toEqual({ "X-Custom": "v", Authorization: "Bearer k" });
  });

  test("does not leak the corsfix option into the fetch init", async () => {
    await corsfix.fetch("https://example.com", { corsfix: { cache: true } });
    expect(lastCall().init).not.toHaveProperty("corsfix");
  });
});

describe("responses", () => {
  test("returns the proxy response untouched on success", async () => {
    const res = proxyResponse("hello");
    fetchMock.mockResolvedValueOnce(res);
    const out = await corsfix.fetch("https://example.com");
    expect(out).toBe(res);
    expect(await out.text()).toBe("hello");
  });

  test("does not throw when the target itself returns an error status", async () => {
    fetchMock.mockResolvedValueOnce(proxyResponse("not found", { status: 404 }));
    const out = await corsfix.fetch("https://example.com/missing");
    expect(out.status).toBe(404);
  });

  test("does not throw when the status header is absent", async () => {
    fetchMock.mockResolvedValueOnce(new Response("plain", { status: 500 }));
    const out = await corsfix.fetch("https://example.com");
    expect(out.status).toBe(500);
  });
});

describe("corsfix errors", () => {
  test("throws CorsfixError with the fields from the proxy body", async () => {
    fetchMock.mockResolvedValueOnce(proxyError("rate_limited", 429));

    const err = await corsfix.fetch("https://example.com").catch((e) => e);

    expect(err).toBeInstanceOf(CorsfixError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("CorsfixError");
    expect(err.code).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.message).toBe("msg for rate_limited");
    expect(err.ifYouAreAdmin).toBe("admin hint");
    expect(err.ifYouAreUser).toBe("user hint");
  });

  test("keeps the raw response readable on the error", async () => {
    fetchMock.mockResolvedValueOnce(proxyError("target_not_allowed", 403));

    const err = await corsfix.fetch("https://example.com").catch((e) => e);

    expect(err.response.status).toBe(403);
    await expect(err.response.json()).resolves.toMatchObject({
      corsfix_error: "target_not_allowed",
    });
  });

  test("falls back to the header code when the body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      proxyResponse("<html>gateway</html>", {
        status: 504,
        corsfixStatus: "timeout",
      })
    );

    const err = await corsfix.fetch("https://example.com").catch((e) => e);

    expect(err).toBeInstanceOf(CorsfixError);
    expect(err.code).toBe("timeout");
    expect(err.status).toBe(504);
    expect(err.message).toBe("Corsfix proxy error: timeout");
    expect(err.ifYouAreAdmin).toBeUndefined();
    expect(err.ifYouAreUser).toBeUndefined();
  });

  test("is exposed on the default export for CDN users", () => {
    expect(corsfix.CorsfixError).toBe(CorsfixError);
  });

  test("propagates network failures from fetch unchanged", async () => {
    const boom = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValueOnce(boom);
    await expect(corsfix.fetch("https://example.com")).rejects.toBe(boom);
  });
});
