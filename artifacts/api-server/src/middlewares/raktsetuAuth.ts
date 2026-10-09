import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireSignedIn: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  res.locals.clerkUserId = userId;
  next();
};

export const requireRaktsetuAdmin: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const metadata = user.privateMetadata as Record<string, unknown>;
    if (metadata.raktsetuRole !== "admin") {
      res.status(403).json({ error: "Administrator access is required." });
      return;
    }

    res.locals.clerkUserId = userId;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Unable to verify RaktSetu administrator");
    res.status(503).json({ error: "Administrator access could not be verified." });
  }
};
