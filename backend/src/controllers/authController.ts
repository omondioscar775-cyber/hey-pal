import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { issueToken, password } from "../modules/auth/service.js";
import { z } from "zod";
import mongoose from "mongoose";
import User from "../models/User.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const register = async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Please check your registration details.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, email, password } = parsed.data;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const { user, token } = await mongoose.connection.transaction(
    async (session) => {
      const user = await new User({
        name,
        email,
        password: hashedPassword,
      }).save({ session });
      const token = await issueToken(
        user.id,
        user.credentialsChangedAt,
        session,
      );
      return { user, token };
    },
  );
  return res.status(201).json({
    success: true,
    message: "Your CircleUp account has been created.",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email and password.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).select("+password");

  if (
    !user ||
    user.accountStatus === "suspended" ||
    user.accountStatus === "deleted"
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const token = await issueToken(
    user._id.toString(),
    user.credentialsChangedAt,
  );

  return res.status(200).json({
    success: true,
    message: "Login successful.",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

export const getMe = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const user = await User.findById(req.userId).select("-password");

  if (
    !user ||
    user.accountStatus === "suspended" ||
    user.accountStatus === "deleted"
  ) {
    return res.status(404).json({
      success: false,
      message: "User account not found.",
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      timezone: user.timezone,
    },
  });
};
