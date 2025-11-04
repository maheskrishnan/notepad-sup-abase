import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import notesRouter from './routes/notes';
import authRouter from './routes/auth';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/notes', notesRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(CONFIG.PORT, () => {
  console.log(`Server running on http://localhost:${CONFIG.PORT}`);
  console.log(`Supabase URL: ${CONFIG.SUPABASE_URL}`);
});
