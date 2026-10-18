// Auth settings from env. Read once and validated, so a misconfigured
// deploy fails at startup instead of on the first login.

export type AuthConfig = {
  jwtSecret: Uint8Array;
  allowedEmailDomains: string[];
  apiPublicUrl: string;
};

let cached: AuthConfig | undefined;

export function getAuthConfig(): AuthConfig {
  if (cached) return cached;

  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters (see server/.env.example)");
  }

  const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  if (allowedEmailDomains.length === 0) {
    throw new Error("ALLOWED_EMAIL_DOMAINS must list at least one school domain, e.g. mcmaster.ca");
  }

  const apiPublicUrl = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`)
    .replace(/\/+$/, "");

  cached = { jwtSecret: new TextEncoder().encode(secret), allowedEmailDomains, apiPublicUrl };
  return cached;
}
