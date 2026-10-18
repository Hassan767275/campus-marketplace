import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { listingsRouter } from "./routes/listings.js";

// Origins allowed to call the API from a browser, e.g. the Vercel URL.
// Comma-separated in CORS_ORIGINS. Empty in local dev, where Vite proxies /api.
function cors(allowed: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
        res.sendStatus(204);
        return;
      }
    }
    next();
  };
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  // Never send internal error details (SQL, stack traces) to the client.
  res.status(500).json({ error: "Internal server error" });
};

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  app.use(cors(allowedOrigins));
  app.use(express.json());

  // Cheap liveness check for the host's health checks; does not touch the DB.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/listings", listingsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
