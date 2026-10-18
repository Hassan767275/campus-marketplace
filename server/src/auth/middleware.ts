import type { RequestHandler } from "express";
import { prisma } from "../db.js";
import { verifySessionToken } from "./tokens.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: AuthUser;
    }
  }
}

/**
 * Protects a route: needs `Authorization: Bearer <token>` from POST /api/auth/login.
 * The user is re-read from the DB on every request, so a deleted user or a
 * changed admin flag takes effect immediately.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const userId = token ? await verifySessionToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, isAdmin: true, emailVerifiedAt: true },
  });
  if (!user || !user.emailVerifiedAt) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  req.user = { id: user.id, email: user.email, displayName: user.displayName, isAdmin: user.isAdmin };
  next();
};

/** Use after requireAuth. */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admins only" });
    return;
  }
  next();
};
