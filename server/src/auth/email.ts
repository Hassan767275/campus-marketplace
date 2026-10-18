import { getAuthConfig } from "./config.js";

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  // Deliberately simple: one @, something on each side, a dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

/** True if the email's domain is an allowed school domain or a subdomain of one (e.g. student.mcmaster.ca). */
export function isSchoolEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return getAuthConfig().allowedEmailDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * No email provider yet: the verification link is logged to the server console
 * (Render/Railway logs when deployed). Replace with a real sender later.
 */
export function sendVerificationEmail(email: string, link: string) {
  console.log(`[email] Verify ${email}: ${link}`);
}
