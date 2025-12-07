import { ErrorRequestHandler, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { AppError } from "../utils/appError";
import { z, ZodError } from "zod";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { config } from "../config/app.config";

const formatZodError = (res: Response, error: z.ZodError) => {
  const errors = error?.issues?.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
  return res.status(HTTPSTATUS.BAD_REQUEST).json({
    message: "Validation failed",
    errors: errors,
    errorCode: ErrorCodeEnum.VALIDATION_ERROR,
  });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next
): any => {
  console.error(`Error Occured on PATH: ${req.path} `, error);

  // Handle OAuth TokenError (e.g., invalid_grant when code is already consumed)
  if (error && typeof error === "object" && "code" in error) {
    const oauthError = error as { code?: string; message?: string; status?: number };
    if (oauthError.code === "invalid_grant") {
      console.warn(
        `[OAUTH ERROR] Invalid grant - OAuth code may have been already consumed: ${req.path}`
      );
      // For OAuth callback routes, redirect to failure page
      // Check both with and without BASE_PATH prefix
      if (req.path.includes("/auth/google/callback") || req.path.includes("google/callback")) {
        return res.redirect(
          `${config.FRONTEND_ORIGIN}/auth/google-failure?error=code_already_used`
        );
      }
      // For other routes, return JSON error
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: "OAuth authorization code has already been used or is invalid",
        errorCode: "OAUTH_INVALID_GRANT",
      });
    }
  }

  if (error instanceof SyntaxError) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON format. Please check your request body.",
    });
  }

  if (error instanceof ZodError) {
    return formatZodError(res, error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      errorCode: error.errorCode,
    });
  }

  return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: "Internal Server Error",
    error: error?.message || "Unknow error occurred",
  });
};
