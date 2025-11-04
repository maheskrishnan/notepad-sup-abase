import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { validateAuth } from '../middleware/validation';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

// Sign up with email and password
router.post('/signup', validateAuth, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: {
        user: data.user,
        session: data.session
      }
    });
  } catch (error: any) {
    console.error('Error signing up:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to sign up'
    });
  }
});

// Sign in with email and password
router.post('/signin', validateAuth, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        user: data.user,
        session: data.session
      }
    });
  } catch (error: any) {
    console.error('Error signing in:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to sign in'
    });
  }
});

// Sign out
router.post('/signout', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error: any) {
    console.error('Error signing out:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sign out'
    });
  }
});

// Get current user
router.get('/user', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) throw error;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    console.error('Error getting user:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to get user'
    });
  }
});

export default router;
