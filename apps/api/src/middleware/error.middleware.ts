import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || (err instanceof ZodError ? 400 : 500);
  
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Structured logging for debugging
  if (statusCode >= 500) {
    // Keep query-string tokens and other URL parameters out of server logs.
    console.error(`[SERVER ERROR] ${req.method} ${req.path}:`, err);
  } else {
    console.warn(`[CLIENT ERROR] ${req.method} ${req.originalUrl} (${statusCode}):`, err.message);
  }

  return res.status(statusCode).json({
    success: false,
    // Database/provider/internal messages must never reach the browser. In
    // particular, Prisma errors disclose schema names and query details.
    message: statusCode >= 500 ? 'Something went wrong. Please try again.' : (err.message || 'Something went wrong. Please try again.'),
  });
};
