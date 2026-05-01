/* eslint-disable no-console */
/**
 * Juliana Balbino — servidor Express + Turso/libSQL
 *
 * Funcionalidades:
 *  - Servir o site estático (HTML/CSS/JS/imagens da pasta /img e /jubalbinodeoliveira).
 *  - Autenticação real do administrador (cookie HTTP-only com JWT).
 *  - CRUD de "slots" de mídia (substituir foto/vídeo de qualquer card do site).
 *  - Upload de fotos e vídeos do admin.
 *  - Listagem das mídias locais da pasta jubalbinodeoliveira/.
 *  - Proxy autenticado para a API do Pexels (curadoria de imagens gratuitas).
 *  - Recebimento de inscrições do formulário de contato.
 *
 *  ATENÇÃO À SEGURANÇA:
 *  - Senhas são armazenadas com bcrypt.
 *  - JWT é assinado com JWT_SECRET (.env).
 *  - Token Turso e demais segredos NUNCA vão para o repositório.
 */
'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const ADMIN_INITIAL_USER = process.env.ADMIN_INITIAL_USER || 'JulianaAdmin';
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'ModaeBemEstar2026#';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

if (!process.env.JWT_SECRET) {
  console.warn('[aviso] JWT_SECRET não definido no .env — gerando um valor temporário (sessões serão invalidadas a cada restart).');
}
if (!process.env.TURSO_DATABASE_URL) {
  console.warn('[aviso] TURSO_DATABASE_URL não definido — usando banco local SQLite "file:./local.db".');
}

const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const LOCAL_MEDIA_DIR = path.join(ROOT, 'jubalbinodeoliveira');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(LOCAL_MEDIA_DIR)) fs.mkdirSync(LOCAL_MEDIA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Banco — Turso (libSQL) ou fallback local
// ---------------------------------------------------------------------------
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS admin_user (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS media_slots (
      slot_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'image',
      src TEXT NOT NULL,
      caption TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      src TEXT NOT NULL,
      thumb TEXT,
      page_url TEXT,
      photographer TEXT,
      alt TEXT,
      tag TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      idade INTEGER,
      cidade TEXT,
      interesses TEXT,
      mensagem TEXT,
      newsletter INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ], 'write');

  // cria admin inicial se não existir
  const existing = await db.execute({
    sql: 'SELECT id FROM admin_user LIMIT 1',
    args: [],
  });
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 12);
    await db.execute({
      sql: 'INSERT INTO admin_user (username, password_hash) VALUES (?, ?)',
      args: [ADMIN_INITIAL_USER, hash],
    });
    console.log(`[ok] Admin inicial criado: ${ADMIN_INITIAL_USER}`);
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

// Estáticos do site
app.use(express.static(ROOT, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Estáticos para uploads e mídia local
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use('/jubalbinodeoliveira', express.static(LOCAL_MEDIA_DIR, { maxAge: '7d' }));

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
const COOKIE_NAME = 'jb_admin';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: NODE_ENV === 'production',
  maxAge: 1000 * 60 * 60 * 8, // 8h
  path: '/',
};

function signToken(user) {
  return jwt.sign({ sub: user.id, u: user.username }, JWT_SECRET, { expiresIn: '8h' });
}

function authRequired(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Limita tentativas de login (proteção contra brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Multer (uploads)
// ---------------------------------------------------------------------------
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, UPLOADS_DIR); },
  filename(_req, file, cb) {
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-60);
    const stamp = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, `${stamp}-${safeBase}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido: ' + file.mimetype));
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
const api = express.Router();

// ---- Auth -----------------------------------------------------------------
api.post('/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });

  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM admin_user WHERE username = ? LIMIT 1',
    args: [String(username)],
  });
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(String(password), String(user.password_hash));
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = signToken({ id: user.id, username: user.username });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ ok: true, user: { username: user.username } });
});

api.post('/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

api.get('/auth/me', authRequired, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT username FROM admin_user WHERE id = ? LIMIT 1',
    args: [req.admin.sub],
  });
  if (result.rows.length === 0) return res.status(401).json({ error: 'gone' });
  res.json({ user: { username: result.rows[0].username } });
});

api.put('/auth/profile', authRequired, async (req, res) => {
  const { newUsername, currentPassword, newPassword } = req.body || {};
  if (!currentPassword) return res.status(400).json({ error: 'missing_current_password' });

  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM admin_user WHERE id = ? LIMIT 1',
    args: [req.admin.sub],
  });
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'not_found' });

  const ok = await bcrypt.compare(String(currentPassword), String(user.password_hash));
  if (!ok) return res.status(401).json({ error: 'invalid_current_password' });

  let nextUsername = user.username;
  let nextHash = user.password_hash;

  if (newUsername && String(newUsername).trim() !== user.username) {
    const u = String(newUsername).trim();
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(u)) return res.status(400).json({ error: 'invalid_username' });
    nextUsername = u;
  }
  if (newPassword) {
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'weak_password' });
    nextHash = await bcrypt.hash(String(newPassword), 12);
  }

  await db.execute({
    sql: "UPDATE admin_user SET username = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    args: [nextUsername, nextHash, user.id],
  });

  // Reemite o cookie com o novo username
  const token = signToken({ id: user.id, username: nextUsername });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ ok: true, user: { username: nextUsername } });
});

// ---- Slots de mídia (substituir foto/vídeo de qualquer card) -------------
api.get('/content/slots', async (_req, res) => {
  const result = await db.execute('SELECT slot_key, kind, src, caption, featured FROM media_slots');
  const slots = {};
  for (const row of result.rows) {
    slots[row.slot_key] = {
      kind: row.kind,
      src: row.src,
      caption: row.caption || '',
      featured: !!row.featured,
    };
  }
  res.json({ slots });
});

api.put('/content/slots/:key', authRequired, async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!/^[a-z0-9._-]{1,60}$/i.test(key)) return res.status(400).json({ error: 'invalid_key' });
  const { kind, src, caption, featured } = req.body || {};
  if (!src) return res.status(400).json({ error: 'missing_src' });
  const k = (kind === 'video') ? 'video' : 'image';

  await db.execute({
    sql: `INSERT INTO media_slots (slot_key, kind, src, caption, featured, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(slot_key) DO UPDATE SET
            kind=excluded.kind, src=excluded.src, caption=excluded.caption,
            featured=excluded.featured, updated_at=datetime('now')`,
    args: [key, k, String(src), caption ? String(caption) : null, featured ? 1 : 0],
  });
  res.json({ ok: true });
});

api.delete('/content/slots/:key', authRequired, async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM media_slots WHERE slot_key = ?',
    args: [String(req.params.key)],
  });
  res.json({ ok: true });
});

// ---- Galeria pública (Pexels curado) -------------------------------------
api.get('/content/gallery', async (_req, res) => {
  const result = await db.execute(
    'SELECT id, src, thumb, page_url, photographer, alt, tag, position FROM gallery_items ORDER BY position ASC, created_at ASC'
  );
  res.json({ items: result.rows });
});

api.put('/content/gallery', authRequired, async (req, res) => {
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : null;
  if (!items) return res.status(400).json({ error: 'missing_items' });

  await db.execute('DELETE FROM gallery_items');
  let pos = 0;
  for (const it of items) {
    if (!it || !it.src) continue;
    pos += 1;
    await db.execute({
      sql: `INSERT INTO gallery_items (id, src, thumb, page_url, photographer, alt, tag, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        String(it.id || ('g' + pos + '-' + Date.now())),
        String(it.src),
        it.thumb ? String(it.thumb) : null,
        it.url ? String(it.url) : (it.page_url ? String(it.page_url) : null),
        it.photographer ? String(it.photographer) : null,
        it.alt ? String(it.alt) : null,
        it.tag ? String(it.tag) : null,
        pos,
      ],
    });
  }
  res.json({ ok: true, count: pos });
});

// ---- Uploads --------------------------------------------------------------
api.post('/uploads', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const url = '/uploads/' + req.file.filename;
  const kind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  res.json({ ok: true, url, kind, mimetype: req.file.mimetype, size: req.file.size });
});

api.get('/uploads', authRequired, (_req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, f));
      const ext = path.extname(f).toLowerCase();
      const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
      return {
        name: f,
        url: '/uploads/' + f,
        kind: isVideo ? 'video' : 'image',
        size: stat.size,
        mtime: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
  res.json({ files });
});

api.delete('/uploads/:name', authRequired, (req, res) => {
  const name = path.basename(req.params.name);
  const target = path.join(UPLOADS_DIR, name);
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return res.status(400).json({ error: 'invalid' });
  if (fs.existsSync(target)) fs.unlinkSync(target);
  res.json({ ok: true });
});

// ---- Mídia local (pasta jubalbinodeoliveira/) ----------------------------
api.get('/local-media', (_req, res) => {
  if (!fs.existsSync(LOCAL_MEDIA_DIR)) return res.json({ files: [] });
  const files = fs.readdirSync(LOCAL_MEDIA_DIR)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const ext = path.extname(f).toLowerCase();
      const isVideo = ['.mp4', '.webm', '.mov', '.m4v'].includes(ext);
      const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext);
      if (!isVideo && !isImage) return null;
      // heurística simples: nome contendo "preto", "dark", "noite", "escur" => destaque
      const lc = f.toLowerCase();
      const dark = /(preto|black|dark|escur|noite|night)/.test(lc);
      return {
        name: f,
        url: '/jubalbinodeoliveira/' + encodeURIComponent(f),
        kind: isVideo ? 'video' : 'image',
        featured: dark,
      };
    })
    .filter(Boolean);
  res.json({ files });
});

// ---- Pexels proxy ---------------------------------------------------------
api.get('/pexels/search', authRequired, async (req, res) => {
  if (!PEXELS_API_KEY) return res.status(503).json({ error: 'pexels_not_configured' });
  const q = String(req.query.q || '').trim();
  const per = Math.min(parseInt(req.query.per_page || '20', 10) || 20, 40);
  if (!q) return res.status(400).json({ error: 'missing_query' });
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per}`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!r.ok) return res.status(r.status).json({ error: 'pexels_error' });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'pexels_fetch_failed' });
  }
});

// ---- Submissões do formulário --------------------------------------------
const submitLimiter = rateLimit({ windowMs: 60 * 1000, max: 8 });

api.post('/submissions', submitLimiter, async (req, res) => {
  const b = req.body || {};
  const nome = String(b.nome || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().slice(0, 120);
  if (nome.length < 2) return res.status(400).json({ error: 'invalid_nome' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });

  const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const interesses = Array.isArray(b.interesses) ? b.interesses.join(',') : String(b.interesses || '');
  await db.execute({
    sql: `INSERT INTO submissions (id, nome, email, idade, cidade, interesses, mensagem, newsletter)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, nome, email,
      b.idade != null && b.idade !== '' ? parseInt(b.idade, 10) : null,
      String(b.cidade || '').slice(0, 80),
      interesses.slice(0, 200),
      String(b.mensagem || '').slice(0, 1000),
      b.newsletter ? 1 : 0,
    ],
  });
  res.json({ ok: true, id });
});

api.get('/submissions', authRequired, async (_req, res) => {
  const result = await db.execute(
    'SELECT id, nome, email, idade, cidade, interesses, mensagem, newsletter, created_at FROM submissions ORDER BY created_at DESC'
  );
  res.json({ items: result.rows });
});

api.delete('/submissions', authRequired, async (_req, res) => {
  await db.execute('DELETE FROM submissions');
  res.json({ ok: true });
});

// ---- Erros ----------------------------------------------------------------
api.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  if (err && err.message && /Tipo de arquivo/.test(err.message)) {
    return res.status(415).json({ error: err.message });
  }
  res.status(500).json({ error: 'server_error' });
});

app.use('/api', api);

// SPA-ish fallback: 404 para tudo que não é estático nem API
app.use((req, res) => {
  if (req.method === 'GET' && req.accepts('html')) {
    return res.status(404).sendFile(path.join(ROOT, 'index.html'));
  }
  res.status(404).json({ error: 'not_found' });
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Juliana Balbino — servidor rodando em http://localhost:${PORT}`);
      console.log(`  ambiente: ${NODE_ENV}`);
      console.log(`  banco: ${process.env.TURSO_DATABASE_URL ? 'Turso/libSQL' : 'SQLite local (./local.db)'}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
