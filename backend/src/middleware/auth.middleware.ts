import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, IUser } from "../models/User.js";
import { sendError } from "../utils/response.js";
import { UserPayload } from "../services/auth.service.js";

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    return;
  }

  const token = authHeader.substring("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
    const user = await User.findById(decoded.userId);
    if (!user) {
      sendError(res, "UNAUTHORIZED", "User not found or account deactivated", 401);
      return;
    }

    req.user = user;
    next();
  } catch {
    sendError(res, "UNAUTHORIZED", "Invalid or expired access token", 401);
  }
}
