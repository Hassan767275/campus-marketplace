/** Router state set when a protected route sends the user to /login. */
export type RedirectState = { from?: string }

/** Only follow in-app paths, never another origin (e.g. "//evil.example"). */
export function safeRedirect(from: string | undefined) {
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}
