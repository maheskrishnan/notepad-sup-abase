import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// Simple in-memory rate limiter
// For production, use Redis-based rate limiter like express-rate-limit with Redis store
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string; // Custom error message
}

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use IP address as key (in production, consider using authenticated user ID)
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      // Initialize or reset the counter
      store[key] = {
        count: 1,
        resetTime: now + options.windowMs
      };
      return next();
    }

    if (store[key].count >= options.max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later',
        retryAfter
      });
    }

    store[key].count++;
    next();
  };
}

// Preset rate limiters for different use cases
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later'
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please slow down'
});
