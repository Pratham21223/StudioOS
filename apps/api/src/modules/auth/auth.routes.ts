import { Router } from "express";
import {
  loginLimiter,
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
  resetPassword,
} from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.validation.js";

export const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

authRouter.get("/csrf", csrf);
authRouter.post("/register", registerLimiter, validateBody(registerSchema), register);
authRouter.post("/login", loginLimiter, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
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
