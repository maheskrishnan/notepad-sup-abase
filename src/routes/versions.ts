import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validateUUID, validateNoteId } from '../middleware/validation';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

interface NoteVersion {
  id: string;
  note_id: string;
  user_id: string;
  version_number: number;
  annotation: string;
  title: string;
  content: string;
  created_at: string;
}

// Get all versions for a specific note
router.get('/note/:noteId', validateNoteId, async (req: AuthRequest, res: Response) => {
  try {
    const { noteId } = req.params;

    const { data, error } = await req.supabaseClient
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .eq('user_id', req.user.id)
      .order('version_number', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error fetching note versions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

// Get a specific version
router.get('/:id', validateUUID, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.supabaseClient
      .from('note_versions')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch version' });
  }
});

// Create a new version for a note
router.post('/note/:noteId', validateNoteId, async (req: AuthRequest, res: Response) => {
  try {
    const { noteId } = req.params;
    const { annotation } = req.body;

    // Validate annotation
    if (!annotation || typeof annotation !== 'string' || annotation.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Annotation is required' });
    }

    if (annotation.length > 500) {
      return res.status(400).json({ success: false, error: 'Annotation must not exceed 500 characters' });
    }

    // Get the current note
    const { data: note, error: noteError } = await req.supabaseClient
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', req.user.id)
      .eq('is_deleted', false)
      .single();

    if (noteError) throw noteError;

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Get the latest version number for this note
    const { data: latestVersion } = await req.supabaseClient
      .from('note_versions')
      .select('version_number')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 0;

    // Create the new version
    const { data: newVersion, error: versionError } = await req.supabaseClient
      .from('note_versions')
      .insert({
        note_id: noteId,
        user_id: req.user.id,
        version_number: nextVersionNumber,
        annotation: annotation.trim(),
        title: note.title,
        content: note.content
      })
      .select()
      .single();

    if (versionError) throw versionError;

    res.json({
      success: true,
      data: newVersion,
      message: `Version ${nextVersionNumber} created successfully`
    });
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ success: false, error: 'Failed to create version' });
  }
});

// Delete a version
router.delete('/:id', validateUUID, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.supabaseClient
      .from('note_versions')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }

    res.json({ success: true, message: 'Version deleted successfully' });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({ success: false, error: 'Failed to delete version' });
  }
});

export default router;
