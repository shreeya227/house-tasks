import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, badRequest, notFound, requireClaims, route } from "./http";
import { issueToken } from "./tokens";

/** The wrapper every API route goes through: errors must become the right status codes. */

const call = (fn: () => Promise<Response>) =>
  route(async () => fn())(new Request("http://test/api"), { params: Promise.resolve({}) });

describe("route()", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes a normal response straight through", async () => {
    const res = await call(async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("turns HttpError into its status with a readable message", async () => {
    let res = await call(async () => { throw notFound("No such week"); });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("No such week");

    res = await call(async () => { throw badRequest("Pick a date"); });
    expect(res.status).toBe(400);
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(async () => { throw new Error("password=hunter2 leaked from the database driver"); });
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain("hunter2");
    expect(body).toBe("Something went wrong. Try again in a moment.");
    expect(logged).toHaveBeenCalled(); // still logged for us, just not shown to the user
  });
});

describe("requireClaims()", () => {
  const withAuth = (value?: string) =>
    new Request("http://test/api", { headers: value ? { authorization: value } : {} });

  it("rejects a missing or forged token with 401", () => {
    process.env.TOKEN_SECRET = "test-secret";
    for (const header of [undefined, "Bearer junk", `Bearer ${issueToken(2, 1, "wrong-secret")}`]) {
      try {
        requireClaims(withAuth(header));
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HttpError);
        expect((e as HttpError).status).toBe(401);
      }
    }
  });

  it("accepts a token signed with the server's secret", () => {
    process.env.TOKEN_SECRET = "test-secret";
    expect(requireClaims(withAuth(`Bearer ${issueToken(2, 1)}`))).toEqual({ personId: 2, householdId: 1 });
  });
});
