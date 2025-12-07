import { Request, Response, NextFunction } from "express";
import { config } from "../config/app.config";

// In-memory store for tracking processed OAuth codes
// In production, consider using Redis for distributed systems
const processedCodes = new Map<string, number>();

// Clean up old codes every 5 minutes (OAuth codes expire quickly)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CODE_TTL = 10 * 60 * 1000; // 10 minutes - codes should be used within this time

setInterval(() => {
  const now = Date.now();
  for (const [code, timestamp] of processedCodes.entries()) {
    if (now - timestamp > CODE_TTL) {
      processedCodes.delete(code);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Middleware to prevent duplicate OAuth code processing
 * OAuth authorization codes can only be used once
 */
export const oauthCodeDeduplication = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    // No code parameter, continue (might be an error response)
    return next();
  }

  const now = Date.now();
  const existingTimestamp = processedCodes.get(code);

  if (existingTimestamp) {
    const timeSinceFirstUse = now - existingTimestamp;
    console.warn(
      `[OAUTH DEDUP] Duplicate OAuth code detected: ${code.substring(0, 10)}... (first used ${Math.round(timeSinceFirstUse / 1000)}s ago)`
    );

    // Return a redirect to frontend with error
    // Don't process the code again
    return res.redirect(
      `${config.FRONTEND_ORIGIN}/auth/google-failure?error=duplicate_code`
    );
  }

  // Mark code as processed
  processedCodes.set(code, now);
  console.log(
    `[OAUTH DEDUP] Processing new OAuth code: ${code.substring(0, 10)}... at ${new Date().toISOString()}`
  );

  // Clean up after successful processing (in case of errors, we still want to prevent reuse)
  res.on("finish", () => {
    // Only remove if the response was successful (2xx or 3xx redirect)
    if (res.statusCode >= 200 && res.statusCode < 400) {
      // Keep it for a short time to catch any race conditions, then remove
      setTimeout(() => {
        processedCodes.delete(code);
        console.log(
          `[OAUTH DEDUP] Cleaned up processed code: ${code.substring(0, 10)}...`
        );
      }, 5000); // Remove after 5 seconds
    }
  });

  next();
};

