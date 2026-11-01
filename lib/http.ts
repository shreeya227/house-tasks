import { NextResponse } from "next/server";
import { householdById, personInHousehold } from "./repo";
import { verifyToken, type Claims } from "./tokens";
import type { Household, Person } from "./types";

/**
 * Small helpers so each route reads like the old Spring controller methods:
 * throw an HttpError anywhere, and route() turns it into a response.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const notFound = (m: string) => new HttpError(404, m);

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: Request, ctx: Ctx<P>) => Promise<Response>;

/** Wraps a route handler: HttpError → its status with a plain-text message, anything else → 500. */
export function route<P = Record<string, string>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return new NextResponse(e.message, { status: e.status });
      }
      console.error(e);
      return new NextResponse("Something went wrong. Try again in a moment.", { status: 500 });
    }
  };
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const noContent = () => new NextResponse(null, { status: 204 });

export function requireClaims(req: Request): Claims {
  const claims = verifyToken(req.headers.get("authorization"));
  if (!claims) throw new HttpError(401, "Sign in again");
  return claims;
}

export interface Session {
  claims: Claims;
  household: Household;
  me: Person;
}

/** Signed-in housemate: valid token, and the person still exists in that household. */
export async function requireSession(req: Request): Promise<Session> {
  const claims = requireClaims(req);
  const [household, me] = await Promise.all([
    householdById(claims.householdId),
    personInHousehold(claims.householdId, claims.personId),
  ]);
  if (!household || !me) throw new HttpError(401, "Sign in again");
  return { claims, household, me };
}

export async function requireAdmin(req: Request): Promise<Session> {
  const s = await requireSession(req);
  if (!s.me.isAdmin) throw new HttpError(403, "Only the house admin can change this");
  return s;
}

/** Route params arrive as strings; ids must be positive integers. */
export function intParam(value: string, what: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) throw badRequest(`Bad ${what}`);
  return n;
}

export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}
