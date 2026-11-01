import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { issueToken, verifyToken } from "./tokens";

const KEY = "test-secret";

describe("tokens", () => {
  it("round-trips", () => {
    expect(verifyToken(issueToken(2, 1, KEY), KEY)).toEqual({ personId: 2, householdId: 1 });
    expect(verifyToken(`Bearer ${issueToken(2, 1, KEY)}`, KEY)).toEqual({ personId: 2, householdId: 1 });
  });

  it("matches the Java format: HMAC-SHA256, base64url, no padding", () => {
    const javaStyle = createHmac("sha256", KEY).update("2.1").digest("base64").replace(/=+$/, "")
      .replace(/\+/g, "-").replace(/\//g, "_");
    expect(issueToken(2, 1, KEY)).toBe(`2.1.${javaStyle}`);
  });

  it("rejects tampering and junk", () => {
    const t = issueToken(2, 1, KEY);
    expect(verifyToken(t.replace(/^2\./, "3."), KEY)).toBeNull();
    expect(verifyToken(t, "other-secret")).toBeNull();
    expect(verifyToken("burlington7", KEY)).toBeNull();
    expect(verifyToken("", KEY)).toBeNull();
    expect(verifyToken(null, KEY)).toBeNull();
  });
});
