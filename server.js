const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ────────────────────────────────────────────────────────────────────
// Set FRONTEND_URL in your backend host's environment variables.
// e.g. https://your-blog.vercel.app
// For local dev, defaults to localhost:3000
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Render health checks)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  }
}));

app.use(express.json());

// ── Letters directory ────────────────────────────────────────────────────────
const LETTERS_DIR = path.join(__dirname, 'letters');

// ── Helpers ──────────────────────────────────────────────────────────────────
function filenameToTitle(filename) {
  return filename
    .replace(/^\d+-/, '')
    .replace(/\.txt$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function safeFilename(filename) {
  return (
    filename.endsWith('.txt') &&
    !filename.includes('/') &&
    !filename.includes('..') &&
    !filename.includes('\\')
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check — used by Render/Railway to confirm the service is up
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/letters — list all letters
app.get('/api/letters', (req, res) => {
  try {
    const files = fs.readdirSync(LETTERS_DIR)
      .filter(f => f.endsWith('.txt'))
      .sort();

    const letters = files.map(filename => {
      const filepath = path.join(LETTERS_DIR, filename);
      const content  = fs.readFileSync(filepath, 'utf-8').trim();
      const stats    = fs.statSync(filepath);
      const lines    = content.split('\n').map(l => l.trim()).filter(Boolean);
      const excerpt  = lines.slice(0, 2).join(' ').substring(0, 160) + (content.length > 160 ? '…' : '');

      return {
        filename,
        title:     filenameToTitle(filename),
        excerpt,
        date:      stats.mtime.toISOString(),
        wordCount: content.split(/\s+/).length,
      };
    });

    res.json(letters);
  } catch (err) {
    console.error('Error reading letters dir:', err);
    res.status(500).json({ error: 'Could not read letters.' });
  }
});

// GET /api/letters/:filename — single letter content
app.get('/api/letters/:filename', (req, res) => {
  const { filename } = req.params;

  if (!safeFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  const filepath = path.join(LETTERS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Letter not found.' });
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const stats   = fs.statSync(filepath);

  res.json({
    filename,
    title:     filenameToTitle(filename),
    content,
    date:      stats.mtime.toISOString(),
    wordCount: content.split(/\s+/).length,
  });
});

// 404 fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n📬 Letters API running on port ${PORT}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log(`   Letters: http://localhost:${PORT}/api/letters\n`);
});
