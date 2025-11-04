import { Request, Response, NextFunction } from 'express';

// Constants for validation
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 1000000; // 1MB of text
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export interface ValidationError {
  field: string;
  message: string;
}

// Validate note creation/update
export function validateNote(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { title, content } = req.body;

  // Validate title
  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push({ field: 'title', message: 'Title must be a string' });
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.push({
        field: 'title',
        message: `Title must not exceed ${MAX_TITLE_LENGTH} characters`
      });
    }
  }

  // Validate content
  if (content !== undefined) {
    if (typeof content !== 'string') {
      errors.push({ field: 'content', message: 'Content must be a string' });
    } else if (content.length > MAX_CONTENT_LENGTH) {
      errors.push({
        field: 'content',
        message: `Content must not exceed ${MAX_CONTENT_LENGTH} characters`
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors
    });
  }

  next();
}

// Validate authentication credentials
export function validateAuth(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { email, password } = req.body;

  // Validate email
  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email must be a string' });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  } else if (email.length > 255) {
    errors.push({ field: 'email', message: 'Email is too long' });
  }

  // Validate password
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password must be a string' });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    });
  } else if (password.length > 128) {
    errors.push({ field: 'password', message: 'Password is too long' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors
    });
  }

  next();
}

// Validate UUID format for IDs
export function validateUUID(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  next();
}
