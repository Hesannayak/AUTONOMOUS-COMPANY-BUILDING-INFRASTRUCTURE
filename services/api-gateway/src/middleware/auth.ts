import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '@acbi/utils';
import { getConfig } from '@acbi/config';

const logger = createLogger('api-gateway:auth');

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

interface JWTPayload {
  userId: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

/**
 * JWT authentication middleware.
 * Validates the token from the Authorization header and extracts the userId.
 *
 * Can be toggled on/off via the AUTH_ENABLED environment variable.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check if auth is enabled (defaults to disabled in development)
  const authEnabled = process.env['AUTH_ENABLED'] === 'true';
  if (!authEnabled) {
    // Auth disabled — pass through with a default dev user
    req.userId = 'dev-user';
    req.userRoles = ['admin'];
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header is required',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header must be in format: Bearer <token>',
    });
    return;
  }

  const token = parts[1]!;

  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

    req.userId = decoded.userId;
    req.userRoles = decoded.roles ?? [];

    logger.debug({ userId: decoded.userId }, 'Request authenticated');
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    logger.warn({ error: message }, 'Authentication failed');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}
