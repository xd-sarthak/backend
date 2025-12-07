import { Request, Response, NextFunction } from "express";
import { config } from "../config/app.config";

// In-memory store for tracking processed OAuth codes
// In production, consider using Redis for distributed systems
// Codes are marked as "consumed" and never removed to prevent reuse
const processedCodes = new Map<string, { 
  timestamp: number; 
  consumed: boolean; 
  redirectUrl?: string; // Store redirect URL for successful authentications
}>();

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

    // Set headers to prevent caching/retries
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Ensure FRONTEND_ORIGIN has protocol
    const frontendOrigin = config.FRONTEND_ORIGIN.startsWith('http') 
      ? config.FRONTEND_ORIGIN 
      : `https://${config.FRONTEND_ORIGIN}`;

    // If the code was already consumed successfully and we have a redirect URL,
    // redirect to the same workspace (likely a browser retry)
    if (existingData.consumed && existingData.redirectUrl) {
      console.log(
        `[OAUTH DEDUP] Code already consumed, redirecting to stored URL: ${existingData.redirectUrl}`
      );
      // Use 307 to preserve method and prevent loops
      return res.redirect(307, `${existingData.redirectUrl}${existingData.redirectUrl.includes('?') ? '&' : '?'}auth=already_authenticated`);
    }

    // If consumed but no redirect URL, redirect to frontend to check auth status
    if (existingData.consumed) {
      console.log(
        `[OAUTH DEDUP] Code already consumed, redirecting to frontend root to check auth`
      );
      // Use 307 to preserve method and prevent loops
      return res.redirect(307, `${frontendOrigin}?auth=check_status`);
    }
    
    // Code is being processed but not yet consumed (race condition)
    // Redirect to frontend to check status
    console.log(
      `[OAUTH DEDUP] Code is being processed, redirecting to frontend to check status`
    );
    // Use 307 to preserve method and prevent loops
    return res.redirect(307, `${frontendOrigin}?auth=processing`);
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
        
        // Store redirect URL if available (from successful authentication)
        const redirectUrl = (req as any).oauthRedirectUrl;
        if (redirectUrl) {
          codeData.redirectUrl = redirectUrl;
          console.log(
            `[OAUTH DEDUP] Marked code as consumed: ${code.substring(0, 10)}... (status: ${res.statusCode}, redirect: ${redirectUrl})`
          );
        } else {
          console.log(
            `[OAUTH DEDUP] Marked code as consumed: ${code.substring(0, 10)}... (status: ${res.statusCode})`
          );
        }
      }
      // Keep the code in the map permanently to prevent any future reuse
      // OAuth codes are single-use tokens and should never be processed again
    }
  });

  next();
};

