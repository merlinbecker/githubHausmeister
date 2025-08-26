import { Request, Response, NextFunction } from "express";
import { databaseStorage } from "./database-storage";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    accessToken: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = await databaseStorage.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email || undefined,
      avatarUrl: user.avatarUrl || undefined,
      accessToken: user.accessToken,
    };
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  
  if (userId) {
    databaseStorage.getUserById(userId)
      .then(user => {
        if (user) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email || undefined,
            avatarUrl: user.avatarUrl || undefined,
            accessToken: user.accessToken,
          };
        }
        next();
      })
      .catch(() => next());
  } else {
    next();
  }
}