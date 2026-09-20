import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import corsfix, { CorsfixError } from "./index.js";

const proxied = (target, base = "https://proxy.corsfix.com") =>
  `${base}/?sdk=1&url=${encodeURIComponent(target)}`;

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
    expect(lastCall().url).toBe(proxied("https://example.com/api?x=1"));
  });

  test("accepts a URL object", async () => {
    await corsfix.fetch(new URL("https://example.com/a?b=2"));
    expect(lastCall().url).toBe(proxied("https://example.com/a?b=2"));
  });
});

describe("proxy url", () => {
  test("uses proxy.corsfix.com by default", async () => {
    await corsfix.fetch("https://example.com");
    expect(lastCall().url).toBe(proxied("https://example.com"));
  });

  test("uses a custom proxy origin", async () => {
    await corsfix.fetch("https://example.com", {
      corsfix: { proxyUrl: "https://proxy-eu.corsfix.com" },
    });
    expect(lastCall().url).toBe(
      proxied("https://example.com", "https://proxy-eu.corsfix.com")
    );
  });

  test("tolerates a trailing slash on the proxy origin", async () => {
    await corsfix.fetch("https://example.com", {
      corsfix: { proxyUrl: "http://localhost:8080/" },
    });
    expect(lastCall().url).toBe(
      proxied("https://example.com", "http://localhost:8080")
    );
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
    expect(sent.url).toBe(proxied("https://example.com/post"));
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

  test("preserves every fetch setting on the Request", async () => {
    const controller = new AbortController();
    const req = new Request("https://example.com/", {
      mode: "no-cors",
      credentials: "include",
      cache: "no-store",
      redirect: "manual",
      referrer: "https://referrer.example/",
      referrerPolicy: "no-referrer",
      keepalive: true,
      signal: controller.signal,
    });

    await corsfix.fetch(req);

    const sent = lastCall().url;
    expect(sent.mode).toBe("no-cors");
    expect(sent.credentials).toBe("include");
    expect(sent.cache).toBe("no-store");
    expect(sent.redirect).toBe("manual");
    expect(sent.referrer).toBe("https://referrer.example/");
    expect(sent.referrerPolicy).toBe("no-referrer");
    expect(sent.keepalive).toBe(true);
    // Request wraps signals in a dependent signal, so check propagation.
    expect(sent.signal.aborted).toBe(false);
    controller.abort();
    expect(sent.signal.aborted).toBe(true);
  });

  test("honours a custom proxyUrl with a Request input", async () => {
    await corsfix.fetch(new Request("https://example.com"), {
      corsfix: { proxyUrl: "https://lite.corsfix.com" },
    });
    // Request normalizes its URL, so the target ends with a slash.
    expect(lastCall().url.url).toBe(
      proxied("https://example.com/", "https://lite.corsfix.com")
    );
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

describe("free tier", () => {
  const USER_COPY = {
    free_tier_transfer_limit: "This site is out of free data for the month.",
    free_tier_concurrency_limit: "This site's free plan allows one visitor at a time.",
  };
  const freeTierError = (code) =>
    proxyError(code, code === "free_tier_concurrency_limit" ? 429 : 403, {
      if_you_are_user: USER_COPY[code],
    });

  // Minimal DOM double: enough for the notice to be built and attached.
  const fakeDocument = () => {
    const makeTextNode = (text) => ({ tag: "#text", textContent: text });
    const makeElement = (tag) => {
      const el = {
        tag,
        id: "",
        style: {},
        children: [],
        attributes: {},
        removed: false,
        querySelector(selector) {
          const attr = selector.replace(/^\[|\]$/g, "");
          const find = (node) =>
            node.attributes?.[attr] !== undefined
              ? node
              : (node.children ?? []).map(find).find(Boolean) ?? null;
          return find(this);
        },
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        remove() {
          this.removed = true;
        },
      };
      return el;
    };
    const body = makeElement("body");
    return {
      body,
      byId: new Map(),
      getElementById(id) {
        return body.children.find((c) => c.id === id) ?? null;
      },
      createElement: makeElement,
      createTextNode: makeTextNode,
      addEventListener: vi.fn(),
    };
  };

  test("flags every request as SDK traffic in the URL", async () => {
    await corsfix.fetch("https://example.com/a?b=1&c=2");
    const url = new URL(lastCall().url);
    expect(url.searchParams.get("sdk")).toBe("1");
    // The target's own query string survives as one encoded value.
    expect(url.searchParams.get("url")).toBe("https://example.com/a?b=1&c=2");
  });

  test("flags a Request input the same way", async () => {
    await corsfix.fetch(new Request("https://example.com"));
    expect(new URL(lastCall().url.url).searchParams.get("sdk")).toBe("1");
  });

  test("throws CorsfixError and renders a notice", async () => {
    const document = fakeDocument();
    vi.stubGlobal("document", document);

    fetchMock.mockResolvedValue(freeTierError("free_tier_transfer_limit"));

    const err = await corsfix.fetch("https://example.com").catch((e) => e);
    expect(err).toBeInstanceOf(CorsfixError);
    expect(err.code).toBe("free_tier_transfer_limit");

    const notice = document.getElementById("corsfix-free-tier-notice");
    expect(notice).not.toBeNull();
    expect(notice.attributes.role).toBe("status");
    const [text, close] = notice.children;
    const [title, body, link] = text.children;
    expect(title.textContent).toBe("This site has reached its free Corsfix limit");
    // Body copy comes from the proxy's if_you_are_user field.
    expect(body.textContent).toBe(USER_COPY.free_tier_transfer_limit);
    expect(link.href).toBe("https://app.corsfix.com/billing");
    expect(link.textContent).toContain("Site owner");
    expect(close.attributes["aria-label"]).toBe("Dismiss");
  });

  test("falls back to generic copy when the proxy sends no user hint", async () => {
    const document = fakeDocument();
    vi.stubGlobal("document", document);
    fetchMock.mockResolvedValueOnce(
      proxyResponse("<html>oops</html>", {
        status: 403,
        corsfixStatus: "free_tier_transfer_limit",
      })
    );

    await corsfix.fetch("https://example.com").catch(() => {});
    const [text] = document.getElementById("corsfix-free-tier-notice").children;
    expect(text.children[1].textContent).toContain("Ask the site owner");
  });

  test("shows the notice again after it was dismissed", async () => {
    const document = fakeDocument();
    vi.stubGlobal("document", document);
    fetchMock.mockResolvedValue(freeTierError("free_tier_transfer_limit"));

    await corsfix.fetch("https://example.com").catch(() => {});
    // Dismissing removes it from the page.
    document.body.children.length = 0;

    await corsfix.fetch("https://example.com").catch(() => {});
    expect(document.getElementById("corsfix-free-tier-notice")).not.toBeNull();
  });

  test("never stacks notices, updates the existing one instead", async () => {
    const document = fakeDocument();
    vi.stubGlobal("document", document);

    fetchMock.mockResolvedValueOnce(freeTierError("free_tier_transfer_limit"));
    await corsfix.fetch("https://example.com").catch(() => {});
    fetchMock.mockResolvedValueOnce(freeTierError("free_tier_concurrency_limit"));
    await corsfix.fetch("https://example.com").catch(() => {});

    const notices = document.body.children.filter(
      (c) => c.id === "corsfix-free-tier-notice"
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].children[0].children[1].textContent).toBe(
      USER_COPY.free_tier_concurrency_limit
    );
  });

  test("uses the concurrency copy for the concurrency limit", async () => {
    const document = fakeDocument();
    vi.stubGlobal("document", document);
    fetchMock.mockResolvedValueOnce(freeTierError("free_tier_concurrency_limit"));

    const err = await corsfix.fetch("https://example.com").catch((e) => e);
    expect(err.code).toBe("free_tier_concurrency_limit");
    const [text] = document.getElementById("corsfix-free-tier-notice").children;
    expect(text.children[1].textContent).toBe(USER_COPY.free_tier_concurrency_limit);
  });

  test("defers the notice until the body exists", async () => {
    const document = fakeDocument();
    document.body = null;
    vi.stubGlobal("document", document);
    fetchMock.mockResolvedValueOnce(freeTierError("free_tier_transfer_limit"));

    await corsfix.fetch("https://example.com").catch(() => {});
    expect(document.addEventListener).toHaveBeenCalledWith(
      "DOMContentLoaded",
      expect.any(Function),
      { once: true }
    );
  });

  test("warns on the console outside a browser", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(freeTierError("free_tier_transfer_limit"));

    const err = await corsfix.fetch("https://example.com").catch((e) => e);
    expect(err.code).toBe("free_tier_transfer_limit");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("[corsfix]");
    warn.mockRestore();
  });

  test("does not show a notice for other proxy errors", async () => {
    const document = fakeDocument();
    vi.stubGlobal("document", document);
    fetchMock.mockResolvedValueOnce(proxyError("rate_limited", 429));

    await corsfix.fetch("https://example.com").catch(() => {});
    expect(document.getElementById("corsfix-free-tier-notice")).toBeNull();
  });
});
