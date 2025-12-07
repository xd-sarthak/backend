import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import session from "cookie-session";
import { config } from "./config/app.config";
import connectDatabase from "./config/database.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { HTTPSTATUS } from "./config/http.config";
import { asyncHandler } from "./middlewares/asyncHandler.middleware";
import { BadRequestException } from "./utils/appError";
import { ErrorCodeEnum } from "./enums/error-code.enum";

import passport from "passport";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import isAuthenticated from "./middlewares/isAuthenticated.middleware";
import workspaceRoutes from "./routes/workspace.route";
import memberRoutes from "./routes/member.route";
import projectRoutes from "./routes/project.route";
import taskRoutes from "./routes/task.route";

const app = express();
const BASE_PATH = config.BASE_PATH;
console.log(">>> EFFECTIVE BASE_PATH =", BASE_PATH);

// Trust proxy - required for Render and other proxy services
// This ensures req.protocol, req.hostname, and req.ip work correctly
app.set("trust proxy", 1);

// CORS configuration — placed at the very top so it runs before any other middleware
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow no-origin requests (health checks, server-to-server, curl, OAuth callbacks from Google)
    if (!origin) return callback(null, true);

    // Normalize FRONTEND_ORIGIN for comparison (remove protocol if present, compare domains)
    const normalizeOrigin = (url: string) => {
      return url.replace(/^https?:\/\//, '').toLowerCase();
    };

    const frontendOriginNormalized = normalizeOrigin(config.FRONTEND_ORIGIN);
    const requestOriginNormalized = normalizeOrigin(origin);

    // Allow frontend origin explicitly (with or without protocol)
    if (
      origin === config.FRONTEND_ORIGIN ||
      requestOriginNormalized === frontendOriginNormalized ||
      origin === `https://${config.FRONTEND_ORIGIN}` ||
      origin === `http://${config.FRONTEND_ORIGIN}`
    ) {
      return callback(null, true);
    }

    // Allow ANY *.vercel.app domain
    if (/\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // Block everything else
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Allow-Credentials",
  ],
};

app.use(cors(corsOptions));

// Ensure preflight requests are handled
app.options("*", cors(corsOptions));

app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url, "ORIGIN:", req.headers.origin);
  next();
});



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load passport configuration after CORS is in place to avoid any thrown errors
// from passport setup running before CORS middleware.
void import("./config/passport.config");

// cookie-session options depend on environment
const isProd = config.NODE_ENV === "production";
app.use(
  session({
    name: "session",
    keys: [config.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: isProd, // secure cookies in production (requires HTTPS)
    httpOnly: true,
    // Use 'none' for cross-origin requests (frontend on vercel.app, backend on render.com)
    // This allows cookies to be sent with cross-origin POST requests (like login)
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    domain: undefined, // Let browser set domain automatically (don't restrict to specific domain)
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get(
  `/`,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    return res.status(HTTPSTATUS.OK).json({
      message: "Hello Subscribe to the channel & share",
    });
  })
);

// Lightweight health-check endpoint (no authentication)
app.get("/health", (_req: Request, res: Response) => res.sendStatus(200));
app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});


app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, isAuthenticated, userRoutes);
app.use(`${BASE_PATH}/workspace`, isAuthenticated, workspaceRoutes);
app.use(`${BASE_PATH}/member`, isAuthenticated, memberRoutes);
app.use(`${BASE_PATH}/project`, isAuthenticated, projectRoutes);
app.use(`${BASE_PATH}/task`, isAuthenticated, taskRoutes);



app.use(errorHandler);

app.listen(config.PORT, async () => {
  console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
  await connectDatabase();
});
