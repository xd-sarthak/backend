import { Router } from "express";
import passport from "passport";
import { config } from "../config/app.config";
import {
  googleLoginCallback,
  loginController,
  logOutController,
  registerUserController,
} from "../controllers/auth.controller";
import { Request,Response,NextFunction } from "express";
const failedUrl = `${config.FRONTEND_GOOGLE_CALLBACK_URL}?status=failure`;

const authRoutes = Router();

authRoutes.post("/register", registerUserController);
authRoutes.post("/login", loginController);

authRoutes.post("/logout", logOutController);

authRoutes.get(
  "/google",
  (req:Request, res:Response, next:NextFunction) => {
    console.log("OAUTH AUTH REQUEST → redirect_uri:", config.GOOGLE_CALLBACK_URL);
    next();
  },
  passport.authenticate("google")
);


authRoutes.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

authRoutes.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: failedUrl,
  }),
  googleLoginCallback
);

export default authRoutes;
