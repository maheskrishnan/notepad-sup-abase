import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config';

export interface AuthRequest extends Request {
  supabaseClient?: any;
  user?: any;
}

// Middleware to authenticate requests and create user-scoped Supabase client
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }

    const token = authHeader.substring(7);

    // Create a Supabase client with the user's token
    const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Verify the token and get user
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Attach the authenticated client and user to the request
    req.supabaseClient = supabaseClient;
    req.user = user;

    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}
