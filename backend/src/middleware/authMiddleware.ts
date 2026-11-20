import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AuthSession } from "../modules/auth/models.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    // Check authorization header
    if (!authorization || !authorization.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
      return;
    }

    // Extract token
    const token = authorization.slice(7).trim();

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
      return;
    }

    // Check JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured.");

      res.status(500).json({
        success: false,
        message: "Authentication service is unavailable.",
      });
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    // Validate token payload
    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(decoded.userId)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    if (!decoded.jti && process.env.REQUIRE_MANAGED_SESSIONS === "true") {
      res
        .status(401)
        .json({ success: false, message: "Please sign in again." });
      return;
    }
    if (decoded.jti) {
      if (!/^[a-f0-9]{24}$/i.test(decoded.jti)) {
        res.status(401).json({ success: false, message: "Invalid session." });
        return;
      }
      const active = await AuthSession.findOne({
        _id: decoded.jti,
        userId: decoded.userId,
        expiresAt: { $gt: new Date() },
        revokedAt: { $exists: false },
      })
        .then(async (session) => {
          if (!session) return null;
          return User.exists({
            _id: decoded.userId,
            accountStatus: { $nin: ["suspended", "deleted"] },
            credentialsChangedAt: session.credentialStamp ?? { $exists: false },
          });
        })
        .catch((error: unknown) => {
          next(error);
          return undefined;
        });
      if (active === undefined) return;
      if (!active) {
        res
          .status(401)
          .json({ success: false, message: "Session expired or revoked." });
        return;
      }
      req.sessionId = decoded.jti;
    }

    // Attach authenticated user ID
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Invalid authentication token. Please log in again.",
    });
  }
};
