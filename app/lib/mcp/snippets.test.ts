import { describe, expect, it } from "vitest";
import { SnippetInput, buildSnippet } from "./snippets";

const base: SnippetInput = {
  url: "https://api.example.com/data?key={{API_KEY}}",
  method: "GET",
  headers: {},
  style: "fetch",
  overrideHeaders: {},
  proxyBaseUrl: "https://proxy.corsfix.com",
};

describe("buildSnippet", () => {
  it("prefixes the target URL with the proxy for fetch, keeping secrets as-is", () => {
    const { code, language } = buildSnippet(base);
    expect(language).toBe("javascript");
    expect(code).toBe(
      'const response = await fetch("https://proxy.corsfix.com/?https://api.example.com/data?key={{API_KEY}}");\nconst data = await response.json();'
    );
  });

  it("adds cache and header override options as Corsfix headers", () => {
    const { code } = buildSnippet({
      ...base,
      method: "POST",
      body: '{"a":1}',
      cache: "10m",
      overrideHeaders: { Origin: "https://example.com" },
    });
    expect(code).toContain('method: "POST"');
    expect(code).toContain('"x-corsfix-cache": "10m"');
    expect(code).toContain(
      '"x-corsfix-headers": JSON.stringify({"Origin":"https://example.com"})'
    );
    expect(code).toContain("body: JSON.stringify(");
  });

  it("uses corsfix.fetch for the SDK and only sets proxyUrl when needed", () => {
    const sdk = buildSnippet({
      ...base,
      style: "sdk",
      sdkProxyUrl: base.proxyBaseUrl,
    });
    expect(sdk.code).toContain('import corsfix from "corsfix"');
    expect(sdk.code).toContain(
      'corsfix.fetch("https://api.example.com/data?key={{API_KEY}}")'
    );
    expect(sdk.code).not.toContain("proxyUrl");

    const regional = buildSnippet({
      ...base,
      style: "sdk-script-tag",
      proxyBaseUrl: "https://proxy-eu.corsfix.com",
      sdkProxyUrl: "https://proxy-eu.corsfix.com",
    });
    expect(regional.language).toBe("html");
    expect(regional.code).toContain(
      '<script src="https://unpkg.com/corsfix"></script>'
    );
    expect(regional.code).toContain('proxyUrl: "https://proxy-eu.corsfix.com"');
  });

  it("quotes curl arguments for the shell", () => {
    const { code, language } = buildSnippet({
      ...base,
      style: "curl",
      method: "POST",
      body: "it's",
    });
    expect(language).toBe("bash");
    expect(code).toContain("-X POST");
    expect(code).toContain("-H 'Origin: http://localhost:3000'");
    expect(code).toContain(`--data 'it'\\''s'`);
  });
});
