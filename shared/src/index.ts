// Types and helpers shared by client, server and worker.
// Must stay free of Node-only and browser-only APIs.

/** Money is always integer cents (see CLAUDE.md). */
export type Cents = number;
