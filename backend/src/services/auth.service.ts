import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, IUser } from "../models/User.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { auditLogService } from "./auditLog.service.js";
import { RegisterInput, LoginInput, ResetPasswordInput } from "../validators/auth.validator.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserPayload {
  userId: string;
  email: string;
  name: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateTokens(user: IUser): AuthTokens {
    const payload: UserPayload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput): Promise<{ user: IUser; tokens: AuthTokens }> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new AppError(409, "CONFLICT", "A user with this email already exists");
    }

    const passwordHash = await this.hashPassword(input.password);
    const user = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name
    });

    const tokens = this.generateTokens(user);

    await auditLogService.recordAction(user._id, "user.registered", "auth", user._id.toString(), undefined, {
      email: user.email,
      name: user.name
    });

    return { user, tokens };
  }

  async login(input: LoginInput): Promise<{ user: IUser; tokens: AuthTokens }> {
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const isValid = await this.comparePassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const tokens = this.generateTokens(user);

    await auditLogService.recordAction(user._id, "user.login", "auth", user._id.toString());

    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid session, user not found");
      }

      const payload: UserPayload = {
        userId: user._id.toString(),
        email: user.email,
        name: user.name
      };

      const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
      return { accessToken };
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
    }
  }

  async forgotPassword(email: string): Promise<{ message: string; devResetLink?: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Do not reveal email existence to avoid enumeration
      return { message: "If an account exists, a password reset link has been dispatched." };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

    if (!env.SMTP_HOST || !env.SMTP_USER) {
      console.log(`\n======================================================`);
      console.log(`[AUTH-DEV] Password reset link for ${user.email}:`);
      console.log(resetUrl);
      console.log(`======================================================\n`);
      return {
        message: "Password reset link generated (logged to console in development mode).",
        devResetLink: env.NODE_ENV === "development" ? resetUrl : undefined
      };
    }

    // SMTP dispatch would go here if configured
    return { message: "If an account exists, a password reset link has been dispatched." };
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new AppError(400, "VALIDATION_ERROR", "Password reset token is invalid or has expired");
    }

    user.passwordHash = await this.hashPassword(input.newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await auditLogService.recordAction(user._id, "user.password_reset", "auth", user._id.toString());
  }
}

export const authService = new AuthService();

