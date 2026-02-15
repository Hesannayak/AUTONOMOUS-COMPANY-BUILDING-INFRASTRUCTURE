import rateLimit from 'express-rate-limit';
import { createLogger } from '@acbi/utils';

const logger = createLogger('api-gateway:rate-limit');

/**
 * Standard rate limiter: 100 requests per 15 minutes per IP.
 */
export const standardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // disable the `X-RateLimit-*` headers
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  handler: (_req, res, _next, options) => {
    logger.warn({ ip: _req.ip }, 'Rate limit exceeded');
    res.status(429).json(options.message);
  },
});

/**
 * Stricter rate limiter for sensitive endpoints (e.g., auth).
 */
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again later.',
  },
});
