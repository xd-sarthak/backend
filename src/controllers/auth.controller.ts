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
      return res.redirect(
        `${config.FRONTEND_ORIGIN}/auth/google-failure?error=no_workspace`
      );
    }

    const redirectUrl = `${config.FRONTEND_ORIGIN}/workspace/${currentWorkspace}`;
    console.log("[GOOGLE CALLBACK] Redirecting to:", redirectUrl);

    // Immediately redirect to frontend - don't send any other response
    return res.redirect(redirectUrl);
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
