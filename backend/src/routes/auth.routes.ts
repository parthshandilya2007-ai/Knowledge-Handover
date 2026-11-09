import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export { router as authRouter };

