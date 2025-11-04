import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { validateAuth, validatePasswordChange, validateEmailChange } from '../middleware/validation';
import { authRateLimiter, passwordChangeRateLimiter } from '../middleware/rateLimiter';
import { authenticate, AuthRequest } from '../middleware/auth';

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

// Change password
// Apply stricter rate limiting to prevent brute-force attacks
router.put('/password', passwordChangeRateLimiter, authenticate, validatePasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // First, verify the current password by attempting to reauthenticate
    // Use a separate sign-in to avoid timing attacks on the main endpoint
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email.toLowerCase(),
      password: currentPassword
    });

    // Use a generic error message to prevent user enumeration
    if (verifyError) {
      console.error('Current password verification failed:', verifyError.message);
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect. Please try again.'
      });
    }

    // Update password using the authenticated client
    // This will automatically verify the user's session
    const { data, error } = await req.supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      // Log the actual error for debugging
      console.error('Supabase password update error:', {
        message: error.message,
        status: error.status,
        code: error.code || 'unknown'
      });

      // Provide more specific error messages based on error type
      let userMessage = 'Failed to change password. Please try again.';

      if (error.message?.includes('Password should be')) {
        userMessage = 'New password does not meet requirements. Please use at least 6 characters.';
      } else if (error.message?.includes('same')) {
        userMessage = 'New password must be different from your current password.';
      } else if (error.message?.includes('session') || error.message?.includes('token')) {
        userMessage = 'Your session has expired. Please log out and log back in.';
      } else if (error.message?.includes('rate limit')) {
        userMessage = 'Too many attempts. Please wait a few minutes and try again.';
      }

      return res.status(400).json({
        success: false,
        error: userMessage
      });
    }

    res.json({
      success: true,
      message: 'Password updated successfully',
      data: { user: data.user }
    });
  } catch (error: any) {
    console.error('Unexpected error changing password:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
    });
  }
});

// Change email
router.put('/email', authenticate, validateEmailChange, async (req: AuthRequest, res: Response) => {
  try {
    const { newEmail } = req.body;

    // Normalize email to lowercase for consistency
    const normalizedEmail = newEmail.toLowerCase().trim();

    // Update email using the authenticated client
    // Supabase will send a verification email automatically
    const { data, error } = await req.supabaseClient.auth.updateUser({
      email: normalizedEmail
    });

    if (error) {
      // Log the actual error for debugging
      console.error('Supabase email update error:', {
        message: error.message,
        status: error.status,
        code: error.code || 'unknown'
      });

      // Provide more specific error messages
      let userMessage = 'Failed to change email. Please try again.';

      if (error.message?.includes('already') || error.message?.includes('exists')) {
        userMessage = 'This email address is already in use. Please use a different email.';
      } else if (error.message?.includes('invalid') || error.message?.includes('format')) {
        userMessage = 'Invalid email format. Please check your email address.';
      } else if (error.message?.includes('session') || error.message?.includes('token')) {
        userMessage = 'Your session has expired. Please log out and log back in.';
      } else if (error.message?.includes('rate limit')) {
        userMessage = 'Too many attempts. Please wait a few minutes and try again.';
      }

      return res.status(400).json({
        success: false,
        error: userMessage
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox to confirm the email change.',
      data: { user: data.user }
    });
  } catch (error: any) {
    console.error('Unexpected error changing email:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
    });
  }
});

export default router;
