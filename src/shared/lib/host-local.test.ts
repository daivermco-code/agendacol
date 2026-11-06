import { describe, expect, it } from "vitest";
import { esHostLocal } from "./host-local";

describe("esHostLocal", () => {
  it.each([
    "localhost",
    "app.localhost",
    "127.0.0.1",
    "10.0.2.2",
    "192.168.1.20",
    "172.16.0.1",
    "172.31.255.255",
    "169.254.1.1",
    "0.0.0.0",
    "0.1.2.3",
    "100.64.0.1",
    "198.18.0.1",
    "[::1]",
    "[::ffff:7f00:1]",
    "[fd12:3456::1]",
    "[fe80::1]",
    "[fe90::1]",
  ])("%s es local", (host) => expect(esHostLocal(host)).toBe(true));

  it.each([
    "abcdefgh.supabase.co",
    "172.32.0.1",
    "8.8.8.8",
    "[2606:4700::1111]",
    "localhost.ejemplo.com",
  ])("%s no es local", (host) => expect(esHostLocal(host)).toBe(false));
});
