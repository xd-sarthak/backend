import { Router } from "express";
import passport from "passport";
import { config } from "../config/app.config";
import {
  googleLoginCallback,
  loginController,
  logOutController,
  registerUserController,
} from "../controllers/auth.controller";
import { Request, Response, NextFunction } from "express";
import { oauthCodeDeduplication } from "../middlewares/oauthCodeDeduplication.middleware";

const authRoutes = Router();

authRoutes.post("/register", registerUserController);
authRoutes.post("/login", loginController);

authRoutes.post("/logout", logOutController);

authRoutes.get(
  "/google",
  (req: Request, res: Response, next: NextFunction) => {
    console.log(
      `[GOOGLE OAUTH] Initiating OAuth flow at ${new Date().toISOString()}`
    );
    console.log("[GOOGLE OAUTH] Callback URL:", config.GOOGLE_CALLBACK_URL);
    console.log("[GOOGLE OAUTH] Frontend Origin:", config.FRONTEND_ORIGIN);
    next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// OAuth callback route with deduplication and error handling
authRoutes.get(
  "/google/callback",
  (req: Request, res: Response, next: NextFunction) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;

    console.log(
      `[GOOGLE CALLBACK] Received callback at ${new Date().toISOString()}`
    );
    console.log("[GOOGLE CALLBACK] Code present:", !!code);
    console.log("[GOOGLE CALLBACK] Error:", error || "none");

    // Set headers to prevent caching/retries on all OAuth callback requests
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (error) {
      console.error(`[GOOGLE CALLBACK] OAuth error: ${error}`);
      return res.redirect(
        `${config.FRONTEND_ORIGIN}/auth/google-failure?error=${encodeURIComponent(error)}`
      );
    }

    next();
  },
  oauthCodeDeduplication,
  // Use standard passport.authenticate - OAuth errors will be caught by error handler
  passport.authenticate("google", {
    failureRedirect: `${config.FRONTEND_ORIGIN}/auth/google-failure`,
    session: true,
  }),
  googleLoginCallback
);

export default authRoutes;
