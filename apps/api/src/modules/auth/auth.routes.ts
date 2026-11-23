import { Router } from "express";
import {
  loginLimiter,
  oauthLimiter,
  otpResendLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  registerLimiter,
} from "../../middleware/rate-limit.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../shared/validation.js";
import {
  csrf,
  forgotPassword,
  login,
  logout,
  me,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.validation.js";
import { listOAuthProviders, oauthCallback, startOAuth } from "./oauth.controller.js";

export const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

authRouter.get("/csrf", csrf);
authRouter.post("/register", registerLimiter, validateBody(registerSchema), register);
authRouter.post("/register/verify", otpVerifyLimiter, validateBody(verifyEmailSchema), verifyEmail);
authRouter.post(
  "/register/resend",
  otpResendLimiter,
  validateBody(resendVerificationSchema),
  resendVerification,
);
authRouter.post("/login", loginLimiter, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
authRouter.get("/oauth/providers", oauthLimiter, listOAuthProviders);
authRouter.get("/oauth/:provider", oauthLimiter, startOAuth);
authRouter.get("/oauth/:provider/callback", oauthLimiter, oauthCallback);
authRouter.post(
  "/password/forgot",
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword,
);
authRouter.post(
  "/password/reset",
  passwordResetLimiter,
  validateBody(resetPasswordSchema),
  resetPassword,
);
