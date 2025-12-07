import passport from "passport";
import { Request } from "express";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";

import { config } from "./app.config";
import { NotFoundException } from "../utils/appError";
import { ProviderEnum } from "../enums/account-provider.enum";
import {
  loginOrCreateAccountService,
  verifyUserService,
} from "../services/auth.service";

passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: config.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"],
      passReqToCallback: true,
    },
    async (req: Request, accessToken, refreshToken, profile, done) => {
      console.log(
        `[PASSPORT GOOGLE] Processing OAuth callback at ${new Date().toISOString()}`
      );
      console.log("[PASSPORT GOOGLE] Callback URL:", config.GOOGLE_CALLBACK_URL);
      try {
        const { email, sub: googleId, picture } = profile._json;
        console.log("[PASSPORT GOOGLE] Profile received:", {
          displayName: profile.displayName,
          email,
          googleId,
          hasPicture: !!picture,
        });

        if (!googleId) {
          console.error("[PASSPORT GOOGLE] Google ID (sub) is missing from profile");
          throw new NotFoundException("Google ID (sub) is missing");
        }

        console.log("[PASSPORT GOOGLE] Creating/updating user account...");
        const { user } = await loginOrCreateAccountService({
          provider: ProviderEnum.GOOGLE,
          displayName: profile.displayName,
          providerId: googleId,
          picture: picture,
          email: email,
        });

        console.log(
          `[PASSPORT GOOGLE] Successfully authenticated user: ${user._id || user.id}`
        );
        done(null, user);
      } catch (error: any) {
        console.error("[PASSPORT GOOGLE] Error during authentication:", {
          message: error?.message,
          stack: error?.stack,
        });
        done(error, false);
      }
    }
  )
);

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      session: true,
    },
    async (email, password, done) => {
      try {
        const user = await verifyUserService({ email, password });
        return done(null, user);
      } catch (error: any) {
        return done(error, false, { message: error?.message });
      }
    }
  )
);

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));
