import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Deliberately minimal auth for a 7-person house: a signed "personId.householdId" token,
 * stored in the browser after someone picks their name. No passwords, no email.
 *
 * Same format and signature as the Spring Boot version (HMAC-SHA256, base64url without
 * padding), so tokens issued there verify here when TOKEN_SECRET is unchanged.
 */

export interface Claims {
  personId: number;
  householdId: number;
}

function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error("TOKEN_SECRET is not set");
  return s;
}

function sign(body: string, key = secret()): string {
  return createHmac("sha256", key).update(body, "utf8").digest("base64url");
}

export function issueToken(personId: number, householdId: number, key?: string): string {
  const body = `${personId}.${householdId}`;
  return `${body}.${sign(body, key)}`;
}

/** The claims, or null when the token is missing, malformed or wrongly signed. */
export function verifyToken(token: string | null | undefined, key?: string): Claims | null {
  if (!token) return null;
  const value = token.startsWith("Bearer ") ? token.slice(7) : token;
  const parts = value.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return null;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, key));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return { personId: Number(parts[0]), householdId: Number(parts[1]) };
}
