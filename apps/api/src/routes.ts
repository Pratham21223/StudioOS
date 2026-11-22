import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { publicInvitationRouter } from "./modules/invitations/invitation.public.routes.js";
import { organizationRouter } from "./modules/organizations/organization.routes.js";
import { portalRouter } from "./modules/portal/portal.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";

export const apiRouter = Router();

apiRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/organizations", organizationRouter);
apiRouter.use("/client-portal", portalRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/invitations", publicInvitationRouter);
