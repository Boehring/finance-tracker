import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) {
      logger.warn('Authentication failed: no token provided', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error: any) {
    logger.warn('Authentication failed: invalid token', {
      error: error.message,
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ error: 'Invalid token' });
  }
};
