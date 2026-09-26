import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/safeFetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safeFetch")>()),
  safeFetch: vi.fn(),
}));

import { SafeFetchResponse, safeFetch } from "@/lib/safeFetch";
import { analyzeRequest, checkCors, evaluatePreflight } from "./corsCheck";

const ORIGIN = "https://myapp.com";

const response = (
  status: number,
  headers: Record<string, string> = {}
): SafeFetchResponse => ({
  status,
  headers,
  body: Buffer.alloc(0),
  truncated: false,
});

describe("analyzeRequest", () => {
  it("treats GET with safelisted headers as a simple request", () => {
    expect(
      analyzeRequest("GET", { Accept: "application/json", "User-Agent": "x" })
    ).toEqual({ needsPreflight: false, reasons: [], unsafeHeaders: [] });
    expect(
      analyzeRequest("POST", { "Content-Type": "text/plain;charset=UTF-8" })
        .needsPreflight
    ).toBe(false);
  });

  it("flags methods, headers and content types that need a preflight", () => {
    const shape = analyzeRequest("PUT", {
      Authorization: "Bearer x",
      "Content-Type": "application/json",
      Range: "bytes=0-10,20-30",
    });
    expect(shape.needsPreflight).toBe(true);
    expect(shape.unsafeHeaders).toEqual([
      "authorization",
      "content-type",
      "range",
    ]);
    expect(shape.reasons).toHaveLength(4);
  });
});

describe("evaluatePreflight", () => {
  const request = {
    origin: ORIGIN,
    method: "PUT",
    unsafeHeaders: ["authorization", "content-type"],
    credentials: false,
  };

  it("passes a preflight that allows the method, headers and origin", () => {
    expect(
      evaluatePreflight(
        response(204, {
          "access-control-allow-origin": ORIGIN,
          "access-control-allow-methods": "GET, PUT",
          "access-control-allow-headers": "Authorization, Content-Type",
        }),
        request
      )
    ).toEqual([]);
  });

  it("does not let * cover Authorization", () => {
    const problems = evaluatePreflight(
      response(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "*",
        "access-control-allow-headers": "*",
      }),
      request
    );
    expect(problems).toEqual([
      "Access-Control-Allow-Headers (*) does not include authorization.",
    ]);
  });

  it("treats * literally for credentialed requests", () => {
    const problems = evaluatePreflight(
      response(200, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "*",
        "access-control-allow-headers": "*",
      }),
      { ...request, unsafeHeaders: ["x-api-key"], credentials: true }
    );
    expect(problems.join(" ")).toMatch(/credentials/);
    expect(problems.join(" ")).toMatch(/does not include PUT/);
    expect(problems.join(" ")).toMatch(/does not include x-api-key/);
  });

  it("reports redirects and error statuses", () => {
    expect(evaluatePreflight(response(301), request)[0]).toMatch(/redirect/);
    expect(evaluatePreflight(response(405), request)[0]).toMatch(
      /returned 405/
    );
  });
});

describe("checkCors", () => {
  const fetchMock = vi.mocked(safeFetch);
  beforeEach(() => fetchMock.mockReset());

  it("reports a blocked request with a proxy fix for the account's proxy", async () => {
    fetchMock.mockResolvedValueOnce(response(200));
    const result = await checkCors({
      url: "https://api.example.com/data",
      origin: ORIGIN,
      method: "GET",
      headers: {},
      credentials: false,
      proxyBaseUrl: "https://proxy.selfhost.example",
    });
    expect(result.verdict).toBe("blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { origin: ORIGIN },
    });
    expect(result).toMatchObject({
      fix: {
        proxied_url:
          "https://proxy.selfhost.example/?https://api.example.com/data",
      },
    });
  });

  it("only sends GET for methods that could change data", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(204, {
          "access-control-allow-origin": ORIGIN,
          "access-control-allow-methods": "DELETE",
        })
      )
      .mockResolvedValueOnce(
        response(200, { "access-control-allow-origin": ORIGIN })
      );
    const result = await checkCors({
      url: "https://api.example.com/items/1",
      origin: ORIGIN,
      method: "DELETE",
      headers: {},
      credentials: false,
      proxyBaseUrl: "https://proxy.corsfix.com",
    });
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
      "OPTIONS",
      "GET",
    ]);
    expect(result.verdict).toBe("allowed");
  });

  it("returns an unknown verdict when the target cannot be reached", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Timed out after 10s"));
    const result = await checkCors({
      url: "https://api.example.com/data",
      origin: ORIGIN,
      method: "GET",
      headers: {},
      credentials: false,
      proxyBaseUrl: "https://proxy.corsfix.com",
    });
    expect(result).toMatchObject({ verdict: "unknown" });
  });
});
