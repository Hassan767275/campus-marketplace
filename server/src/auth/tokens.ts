import { SignJWT, jwtVerify } from "jose";
import { getAuthConfig } from "./config.js";

// Two kinds of signed token, kept apart by audience so one can't be used as the other.
const ISSUER = "campus-marketplace";
const SESSION_AUDIENCE = "session";
const VERIFY_EMAIL_AUDIENCE = "verify-email";

export const SESSION_TTL = "7d";
const VERIFY_EMAIL_TTL = "24h";

async function sign(sub: string, audience: string, ttl: string, claims: Record<string, unknown> = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getAuthConfig().jwtSecret);
}

/** Returns the payload, or null for any invalid, expired or wrong-purpose token. */
async function verify(token: string, audience: string) {
  try {
    const { payload } = await jwtVerify(token, getAuthConfig().jwtSecret, {
      issuer: ISSUER,
      audience,
      algorithms: ["HS256"],
    });
    return payload.sub ? payload : null;
  } catch {
    return null;
  }
}

export function signSessionToken(userId: string) {
  return sign(userId, SESSION_AUDIENCE, SESSION_TTL);
}

export async function verifySessionToken(token: string): Promise<string | null> {
  return (await verify(token, SESSION_AUDIENCE))?.sub ?? null;
}

// The email is included so a link stops working if the account's email ever changes.
export function signVerifyEmailToken(userId: string, email: string) {
  return sign(userId, VERIFY_EMAIL_AUDIENCE, VERIFY_EMAIL_TTL, { email });
}

export async function verifyVerifyEmailToken(token: string) {
  const payload = await verify(token, VERIFY_EMAIL_AUDIENCE);
  if (!payload || typeof payload.email !== "string") return null;
  return { userId: payload.sub!, email: payload.email };
}
