// Session token storage. localStorage keeps users logged in across tabs and reloads;
// storage can throw (private mode, blocked site data), so every access is guarded.
const TOKEN_KEY = 'cm.session'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Not persisted; the user stays logged in until the page reloads.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}
