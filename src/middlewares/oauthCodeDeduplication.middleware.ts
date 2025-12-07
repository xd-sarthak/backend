import { Request, Response, NextFunction } from "express";
import { config } from "../config/app.config";

// In-memory store for tracking processed OAuth codes
// In production, consider using Redis for distributed systems
// Codes are marked as "consumed" and never removed to prevent reuse
const processedCodes = new Map<string, { timestamp: number; consumed: boolean }>();

// Clean up very old codes (older than 1 hour) to prevent memory leaks
// OAuth codes are single-use and should never be reused, so we keep them for a long time
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const CODE_TTL = 60 * 60 * 1000; // 1 hour - codes should never be reused

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [code, data] of processedCodes.entries()) {
    if (now - data.timestamp > CODE_TTL) {
      processedCodes.delete(code);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[OAUTH DEDUP] Cleaned up ${cleaned} old codes from memory`);
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
  const existingData = processedCodes.get(code);

  if (existingData) {
    const timeSinceFirstUse = now - existingData.timestamp;
    console.warn(
      `[OAUTH DEDUP] Duplicate OAuth code detected: ${code.substring(0, 10)}... (first used ${Math.round(timeSinceFirstUse / 1000)}s ago, consumed: ${existingData.consumed})`
    );

    // Return a redirect to frontend with error
    // Don't process the code again - OAuth codes are single-use
    return res.redirect(
      `${config.FRONTEND_ORIGIN}/auth/google-failure?error=duplicate_code`
    );
  }

  // Mark code as being processed immediately (before passport tries to exchange it)
  // This prevents race conditions where multiple requests arrive before any finish
  processedCodes.set(code, { timestamp: now, consumed: false });
  console.log(
    `[OAUTH DEDUP] Processing new OAuth code: ${code.substring(0, 10)}... at ${new Date().toISOString()}`
  );

  // Mark as consumed when the response finishes successfully
  // This ensures we track that the code was actually used
  res.on("finish", () => {
    const codeData = processedCodes.get(code);
    if (codeData) {
      // Mark as consumed if the response was successful (2xx or 3xx redirect)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        codeData.consumed = true;
        console.log(
          `[OAUTH DEDUP] Marked code as consumed: ${code.substring(0, 10)}... (status: ${res.statusCode})`
        );
      }
      // Keep the code in the map permanently to prevent any future reuse
      // OAuth codes are single-use tokens and should never be processed again
    }
  });

  next();
};

