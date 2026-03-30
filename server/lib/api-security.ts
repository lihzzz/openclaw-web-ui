import type { CorsOptions } from "cors";
import type { NextFunction, Request, Response } from "express";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function parseConfiguredOrigins(): Set<string> {
  const configured = process.env.CORS_ORIGINS;
  const values = configured
    ? configured.split(",").map((item) => item.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(values);
}

export function createCorsOptions(): CorsOptions {
  const allowedOrigins = parseConfiguredOrigins();
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin denied"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  };
}

export function requireApiAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = (process.env.API_AUTH_TOKEN || "").trim();
  if (!expected) {
    next();
    return;
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
