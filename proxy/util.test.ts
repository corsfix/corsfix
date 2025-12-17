import { describe, expect, test } from "vitest";
import { isLocalDomain } from "./lib/util";

describe("isLocalDomain", () => {
  test("exact match domains", () => {
    expect(isLocalDomain("localhost")).toBe(true);
    expect(isLocalDomain("corsfix.com")).toBe(true);
    expect(isLocalDomain("app.corsfix.com")).toBe(true);
  });

  test(".localhost subdomains", () => {
    expect(isLocalDomain("myapp.localhost")).toBe(true);
    expect(isLocalDomain("api.localhost")).toBe(true);
    expect(isLocalDomain("dev.test.localhost")).toBe(true);
  });

  test("IPv6 loopback", () => {
    expect(isLocalDomain("::1")).toBe(true);
    expect(isLocalDomain("[::1]")).toBe(true);
  });

  test("IPv4 loopback range (127.x.x.x)", () => {
    expect(isLocalDomain("127.0.0.1")).toBe(true);
    expect(isLocalDomain("127.0.0.2")).toBe(true);
    expect(isLocalDomain("127.255.255.255")).toBe(true);
  });

  test("IPv4 Class A private (10.x.x.x)", () => {
    expect(isLocalDomain("10.0.0.1")).toBe(true);
    expect(isLocalDomain("10.255.255.255")).toBe(true);
  });

  test("IPv4 Class C private (192.168.x.x)", () => {
    expect(isLocalDomain("192.168.0.1")).toBe(true);
    expect(isLocalDomain("192.168.1.100")).toBe(true);
    expect(isLocalDomain("192.168.255.255")).toBe(true);
  });

  test("IPv4 Class B private (172.16-31.x.x)", () => {
    expect(isLocalDomain("172.16.0.1")).toBe(true);
    expect(isLocalDomain("172.20.5.10")).toBe(true);
    expect(isLocalDomain("172.31.255.255")).toBe(true);
    // Outside range should be false
    expect(isLocalDomain("172.15.0.1")).toBe(false);
    expect(isLocalDomain("172.32.0.1")).toBe(false);
  });

  test("IPv4 unspecified (0.0.0.0)", () => {
    expect(isLocalDomain("0.0.0.0")).toBe(true);
  });

  test("public domains should return false", () => {
    expect(isLocalDomain("google.com")).toBe(false);
    expect(isLocalDomain("example.org")).toBe(false);
    expect(isLocalDomain("api.github.com")).toBe(false);
  });

  test("public IPs should return false", () => {
    expect(isLocalDomain("8.8.8.8")).toBe(false);
    expect(isLocalDomain("1.1.1.1")).toBe(false);
    expect(isLocalDomain("203.0.113.50")).toBe(false);
  });
});
