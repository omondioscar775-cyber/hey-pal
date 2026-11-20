import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
    const decoded = jwt.verify(token, secret);

    // Validate token payload
    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      decoded.userId.length === 0
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
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
