import dns from "dns";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SafeFetchError,
  assertFetchableUrl,
  isPublicAddress,
  safeFetch,
} from "./safeFetch";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "104.16.0.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "255.255.255.255",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe("assertFetchableUrl", () => {
  it.each([
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f.1/",
    "http://[::1]:8080/",
    "http://[::ffff:169.254.169.254]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:3000/",
    "http://api.localhost/",
    "https://user:pass@example.com/",
    "ftp://example.com/file",
    "file:///etc/passwd",
  ])("refuses %s", (value) => {
    expect(() => assertFetchableUrl(new URL(value))).toThrow(SafeFetchError);
  });

  it("allows public http(s) URLs", () => {
    expect(() =>
      assertFetchableUrl(new URL("https://api.example.com/data"))
    ).not.toThrow();
    expect(() => assertFetchableUrl(new URL("http://8.8.8.8/"))).not.toThrow();
  });
});

describe("safeFetch", () => {
  it("refuses private IP literals before connecting", async () => {
    await expect(safeFetch("http://127.0.0.1:1/")).rejects.toThrow(
      "127.0.0.1 is not a public address"
    );
  });

  it("refuses hostnames that resolve to a private address", async () => {
    vi.spyOn(dns, "lookup").mockImplementation(((
      _hostname: string,
      _options: unknown,
      callback: (err: null, addresses: dns.LookupAddress[]) => void
    ) => {
      callback(null, [
        { address: "93.184.215.14", family: 4 },
        { address: "10.0.0.8", family: 4 },
      ]);
    }) as unknown as typeof dns.lookup);

    await expect(safeFetch("http://rebind.example.test/")).rejects.toThrow(
      "does not resolve to a public address"
    );
  });
});
