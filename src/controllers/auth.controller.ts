import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { config } from "../config/app.config";
import { registerSchema } from "../validation/auth.validation";
import { HTTPSTATUS } from "../config/http.config";
import { registerUserService } from "../services/auth.service";
import passport from "passport";

export const googleLoginCallback = asyncHandler(
  async (req: Request, res: Response) => {
    console.log(
      `[GOOGLE CALLBACK] Successfully authenticated user at ${new Date().toISOString()}`
    );

    if (!req.user) {
      console.error("[GOOGLE CALLBACK] No user found in request after authentication");
      // Set headers to prevent caching/retries
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.redirect(
        `${config.FRONTEND_ORIGIN}/auth/google-failure?error=no_user`
      );
    }

    const currentWorkspace = req.user?.currentWorkspace;
    const userId = (req.user as any)?._id || (req.user as any)?.id;

    console.log("[GOOGLE CALLBACK] User ID:", userId);
    console.log("[GOOGLE CALLBACK] Current Workspace:", currentWorkspace);

    if (!currentWorkspace) {
      console.warn(
        "[GOOGLE CALLBACK] User authenticated but no current workspace found"
      );
      // Set headers to prevent caching/retries
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.redirect(
        `${config.FRONTEND_ORIGIN}/auth/google-failure?error=no_workspace`
      );
    }

    const redirectUrl = `${config.FRONTEND_ORIGIN}/workspace/${currentWorkspace}?auth=success`;
    
    // Store redirect URL in request for deduplication middleware to use
    // This allows duplicate requests to redirect to the correct workspace
    (req as any).oauthRedirectUrl = redirectUrl;

    // Ensure session is saved before redirecting
    // This is important for cross-domain redirects
    return new Promise<void>((resolve, reject) => {
      req.session?.save((err: Error | null) => {
        if (err) {
          console.error("[GOOGLE CALLBACK] Error saving session:", err);
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          return res.redirect(
            `${config.FRONTEND_ORIGIN}/auth/google-failure?error=session_error`
          );
        }

        console.log("[GOOGLE CALLBACK] Redirecting to:", redirectUrl);

        // Set headers to prevent caching/retries and ensure clean redirect
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
        
        // Perform redirect
        res.redirect(302, redirectUrl);
        resolve();
      });
    });
  }
);

export const registerUserController = asyncHandler(
  async (req: Request, res: Response) => {
    console.log("REGISTER HIT");

    const body = registerSchema.parse({
      ...req.body,
    });

    await registerUserService(body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "User created successfully",
    });
  }
);

export const loginController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "local",
      (
        err: Error | null,
        user: Express.User | false,
        info: { message: string } | undefined
      ) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res.status(HTTPSTATUS.UNAUTHORIZED).json({
            message: info?.message || "Invalid email or password",
          });
        }

        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }

          return res.status(HTTPSTATUS.OK).json({
            message: "Logged in successfully",
            user,
          });
        });
      }
    )(req, res, next);
  }
);

export const logOutController = asyncHandler(
  async (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res
          .status(HTTPSTATUS.INTERNAL_SERVER_ERROR)
          .json({ error: "Failed to log out" });
      }
    });

    req.session = null;
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Logged out successfully" });
  }
);
