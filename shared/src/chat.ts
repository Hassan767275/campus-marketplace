// Chat rules shared by the API (validation) and the client (message box).

export const CHAT_LIMITS = {
  messageMax: 2000,
  /** Messages returned per fetch. */
  pageMax: 100,
} as const;
