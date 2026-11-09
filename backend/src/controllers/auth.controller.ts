import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema
} from "../validators/auth.validator.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { setRefreshTokenCookie, clearRefreshTokenCookie, getCookie } from "../utils/cookies.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const { user, tokens } = await authService.register(input);

    setRefreshTokenCookie(res, tokens.refreshToken);

    sendSuccess(
      res,
      {
        token: tokens.accessToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          createdAt: user.createdAt
        }
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const { user, tokens } = await authService.login(input);

    setRefreshTokenCookie(res, tokens.refreshToken);

    sendSuccess(res, {
      token: tokens.accessToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokenFromCookie = getCookie(req, "refreshToken");
    const tokenFromBody = req.body?.refreshToken;
    const refreshToken = tokenFromCookie || tokenFromBody;

    if (!refreshToken) {
      sendError(res, "UNAUTHORIZED", "Refresh token missing", 401);
      return;
    }

    const { accessToken } = await authService.refresh(refreshToken);
    sendSuccess(res, { token: accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  clearRefreshTokenCookie(res);
  sendSuccess(res, { message: "Successfully logged out" });
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(input.email);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(input);
    sendSuccess(res, { message: "Password has been successfully updated" });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  sendSuccess(res, {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    }
  });
}

export async function updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateProfileSchema.parse(req.body);
    const user = req.user!;

    if (input.name) {
      user.name = input.name;
      await user.save();
    }

    sendSuccess(res, {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
}
