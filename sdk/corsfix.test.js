import { describe, expect, test, vi } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Builds the CDN bundle the same way `pnpm build` does and evaluates it
// against a fake window, checking that it behaves like the ESM entry.
const bundle = async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("./browser.js", import.meta.url))],
    bundle: true,
    format: "iife",
    write: false,
  });
  return result.outputFiles[0].text;
};

describe("CDN bundle", () => {
  test("exposes corsfix.fetch and corsfix.CorsfixError on the global", async () => {
    const code = await bundle();
    const fetchMock = vi.fn(async () =>
      new Response("ok", { headers: { "x-corsfix-status": "success" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("corsfix", undefined);

    try {
      new Function(code)();
      const { corsfix } = globalThis;

      expect(typeof corsfix.fetch).toBe("function");
      expect(typeof corsfix.CorsfixError).toBe("function");

      const res = await corsfix.fetch("https://example.com", {
        corsfix: { cache: true },
      });
      expect(await res.text()).toBe("ok");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://proxy.corsfix.com/?https://example.com");
      expect(init.headers.get("x-corsfix-cache")).toBe("true");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("throws corsfix.CorsfixError on proxy errors", async () => {
    const code = await bundle();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ corsfix_error: "invalid_url", message: "bad" }),
          { status: 400, headers: { "x-corsfix-status": "invalid_url" } }
        )
      )
    );
    vi.stubGlobal("corsfix", undefined);

    try {
      new Function(code)();
      const { corsfix } = globalThis;
      const err = await corsfix.fetch("not a url").catch((e) => e);
      expect(err).toBeInstanceOf(corsfix.CorsfixError);
      expect(err.code).toBe("invalid_url");
      expect(err.message).toBe("bad");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
