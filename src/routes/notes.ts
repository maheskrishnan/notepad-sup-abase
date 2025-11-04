import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateNote, validateUUID } from '../middleware/validation';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Apply rate limiting and authentication middleware to all routes
router.use(apiRateLimiter);
router.use(authenticate);

// Get all notes for authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await req.supabaseClient
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

// Get a single note by ID
router.get('/:id', validateUUID, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.supabaseClient
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch note' });
  }
});

// Create a new note
router.post('/', validateNote, async (req: AuthRequest, res: Response) => {
  try {
    const { title = 'Untitled', content = '' } = req.body;

    console.log('Creating note for user:', req.user.id);

    const { data, error } = await req.supabaseClient
      .from('notes')
      .insert([{
        title,
        content,
        user_id: req.user.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating note:', error);
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (error: any) {
    console.error('Error creating note:', error);
    // Only expose detailed errors in development
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to create note'
      : error.message || 'Failed to create note';

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Update a note
router.put('/:id', validateUUID, validateNote, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const updateData: Partial<Note> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    const { data, error } = await req.supabaseClient
      .from('notes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

// Delete a note
router.delete('/:id', validateUUID, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await req.supabaseClient
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

export default router;
