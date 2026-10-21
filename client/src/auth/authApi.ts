import { api } from '../api/client'

// Mirrors the server's public user shape (server/src/routes/auth.ts).
export type User = {
  id: string
  email: string
  displayName: string
  isAdmin: boolean
}

export type SignupInput = { email: string; password: string; displayName: string }

export function signup(input: SignupInput) {
  return api<{ user: User; message: string }>('/api/auth/signup', { method: 'POST', body: input })
}

export function login(email: string, password: string) {
  return api<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: { email, password } })
}

export function resendVerification(email: string) {
  return api<{ ok: true; message: string }>('/api/auth/resend-verification', { method: 'POST', body: { email } })
}

export function fetchMe(signal?: AbortSignal) {
  return api<{ user: User }>('/api/auth/me', { signal })
}
