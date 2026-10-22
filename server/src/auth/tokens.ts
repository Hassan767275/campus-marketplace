import { SignJWT, errors, jwtVerify, type JWTPayload } from "jose";
import { getAuthConfig } from "./config.js";

// Three kinds of signed token, kept apart by audience so one can't be used as another.
const ISSUER = "campus-marketplace";
const SESSION_AUDIENCE = "session";
const VERIFY_EMAIL_AUDIENCE = "verify-email";
const HANDOFF_AUDIENCE = "qr-handoff";

export const SESSION_TTL = "7d";
const VERIFY_EMAIL_TTL = "24h";

async function sign(sub: string, audience: string, ttl: string | Date, claims: Record<string, unknown> = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getAuthConfig().jwtSecret);
}

const verifyOptions = (audience: string) => ({ issuer: ISSUER, audience, algorithms: ["HS256"] });

/** Returns the payload, or null for any invalid, expired or wrong-purpose token. */
async function verify(token: string, audience: string) {
  try {
    const { payload } = await jwtVerify(token, getAuthConfig().jwtSecret, verifyOptions(audience));
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

// QR handoff token: shown by the seller, redeemed by the buyer. The nonce is
// the jti and matches a qr_tokens row, which is what makes it single-use.
export type HandoffClaims = { orderId: string; sellerId: string; nonce: string };

export function signHandoffToken(claims: HandoffClaims, expiresAt: Date) {
  return sign(claims.orderId, HANDOFF_AUDIENCE, expiresAt, { sid: claims.sellerId, jti: claims.nonce });
}

function handoffClaims(payload: JWTPayload): HandoffClaims | null {
  const { sub, sid, jti } = payload;
  if (typeof sub !== "string" || typeof sid !== "string" || typeof jti !== "string") return null;
  return { orderId: sub, sellerId: sid, nonce: jti };
}

/**
 * null for a bad signature, wrong audience or missing claims. An expired
 * token comes back as `expired` with its claims: jose only reports expiry
 * after the signature checked out, so the claims are still ours.
 */
export async function verifyHandoffToken(
  token: string,
): Promise<{ status: "valid" | "expired"; claims: HandoffClaims } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthConfig().jwtSecret, verifyOptions(HANDOFF_AUDIENCE));
    const claims = handoffClaims(payload);
    return claims && { status: "valid", claims };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      const claims = handoffClaims(err.payload);
      return claims && { status: "expired", claims };
    }
    return null;
  }
}
