/* eslint-disable no-console */
/**
 * Juliana Balbino — servidor Express + Turso/libSQL
 *
 * Compatível com Vercel (serverless): uploads ficam armazenados no Turso como BLOB
 * e são servidos via GET /uploads/:id. Em desenvolvimento local (npm start) o
 * mesmo código sobe um servidor HTTP.
 *
 * Segurança:
 *  - Senhas com bcrypt (12 rounds).
 *  - Sessão por cookie HTTP-only assinado com JWT_SECRET.
 *  - Rate limit em login e em submissão do formulário.
 *  - Uploads validados por mimetype, com limite de 25 MB.
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
const IS_VERCEL = !!process.env.VERCEL;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
// Aceita tanto ADMIN_INITIAL_USER/PASSWORD quanto ADMIN_USER/ADMIN_PASS (Vercel).
const ADMIN_INITIAL_USER =
  process.env.ADMIN_INITIAL_USER || process.env.ADMIN_USER || 'JulianaAdmin';
const ADMIN_INITIAL_PASSWORD =
  process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASS || 'ModaeBemEstar2026#';

if (!process.env.JWT_SECRET) {
  console.warn('[aviso] JWT_SECRET não definido — sessões serão invalidadas a cada restart.');
}

const ROOT = path.resolve(__dirname);
const LOCAL_MEDIA_DIR = path.join(ROOT, 'fotos');
const LOCAL_MEDIA_URL = '/fotos';

// Categorias do site (em ordem) — usadas para distribuir as fotos da pasta
// fotos/ entre as páginas. Cada "shoot" (mesmo prefixo de timestamp do Instagram)
// fica inteiro na mesma categoria, e os shoots se alternam de forma determinística.
const SITE_CATEGORIES = ['moda', 'bem-estar', 'vida'];

function extractShootKey(name) {
  // jubalbinodeoliveira_<unix>_<id>_<author>.<ext> → usa o <unix> como agrupador
  const m = /_(\d{9,11})_/.exec(name);
  return m ? m[1] : name;
}

// ---------------------------------------------------------------------------
// Banco — Turso (libSQL) ou fallback local
// ---------------------------------------------------------------------------
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

let dbReady = null;
function ensureDb() {
  if (dbReady) return dbReady;
  dbReady = (async () => {
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
      `CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        kind TEXT NOT NULL,
        size INTEGER NOT NULL,
        data BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS text_slots (
        slot_key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ], 'write');

    const existing = await db.execute('SELECT id FROM admin_user LIMIT 1');
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 12);
      await db.execute({
        sql: 'INSERT INTO admin_user (username, password_hash) VALUES (?, ?)',
        args: [ADMIN_INITIAL_USER, hash],
      });
      console.log(`[ok] Admin inicial criado: ${ADMIN_INITIAL_USER}`);
    } else if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
      // Permite (re)definir o admin via variáveis de ambiente.
      // Útil quando ADMIN_PASS muda na Vercel: força o sync com o banco.
      const hash = await bcrypt.hash(String(process.env.ADMIN_PASS), 12);
      await db.execute({
        sql: `INSERT INTO admin_user (username, password_hash) VALUES (?, ?)
              ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
        args: [String(process.env.ADMIN_USER), hash],
      });
      console.log(`[ok] Admin sincronizado com env: ${process.env.ADMIN_USER}`);
    }
  })().catch((err) => { dbReady = null; throw err; });
  return dbReady;
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

// Garante que o DB esteja inicializado em qualquer rota (frio em serverless).
app.use(async (_req, _res, next) => {
  try { await ensureDb(); next(); } catch (err) { next(err); }
});

// Estáticos quando rodando localmente (Vercel já serve a partir do filesystem).
if (!IS_VERCEL) {
  app.use(express.static(ROOT, {
    index: 'index.html',
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.use(LOCAL_MEDIA_URL, express.static(LOCAL_MEDIA_DIR, { maxAge: '7d' }));
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
const COOKIE_NAME = 'jb_admin';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: NODE_ENV === 'production' || IS_VERCEL,
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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Multer (uploads em memória — gravados depois no Turso)
// ---------------------------------------------------------------------------
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (limite seguro para serverless)
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido: ' + file.mimetype));
    }
    cb(null, true);
  },
});

function genId(len) {
  return crypto.randomBytes(len || 8).toString('hex');
}

// ---------------------------------------------------------------------------
// Rotas
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
  const token = signToken({ id: user.id, username: nextUsername });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ ok: true, user: { username: nextUsername } });
});

// ---- Slots ----------------------------------------------------------------
api.get('/content/slots', async (_req, res) => {
  const result = await db.execute('SELECT slot_key, kind, src, caption, featured FROM media_slots');
  const slots = {};
  for (const row of result.rows) {
    slots[row.slot_key] = {
      kind: row.kind, src: row.src,
      caption: row.caption || '', featured: !!row.featured,
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

// ---- Textos editáveis -----------------------------------------------------
api.get('/content/texts', async (_req, res) => {
  const result = await db.execute('SELECT slot_key, value FROM text_slots');
  const texts = {};
  for (const row of result.rows) texts[row.slot_key] = row.value || '';
  res.json({ texts });
});

api.put('/content/texts', authRequired, async (req, res) => {
  const texts = req.body && req.body.texts;
  if (!texts || typeof texts !== 'object') return res.status(400).json({ error: 'missing_texts' });
  const entries = Object.entries(texts);
  for (const [key, value] of entries) {
    if (!/^[a-z0-9._-]{1,80}$/i.test(key)) continue;
    const v = String(value == null ? '' : value).slice(0, 4000);
    await db.execute({
      sql: `INSERT INTO text_slots (slot_key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(slot_key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
      args: [key, v],
    });
  }
  res.json({ ok: true, count: entries.length });
});

// ---- Galeria --------------------------------------------------------------
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

// ---- Uploads (armazenados no Turso como BLOB) -----------------------------
api.post('/uploads', authRequired, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const id = Date.now().toString(36) + '-' + genId(4);
  const kind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  await db.execute({
    sql: `INSERT INTO uploads (id, name, mimetype, kind, size, data) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, req.file.originalname.slice(-100), req.file.mimetype, kind, req.file.size, req.file.buffer],
  });
  res.json({ ok: true, url: '/uploads/' + id, kind, mimetype: req.file.mimetype, size: req.file.size });
});

api.get('/uploads', authRequired, async (_req, res) => {
  const r = await db.execute(
    'SELECT id, name, mimetype, kind, size, created_at FROM uploads ORDER BY created_at DESC'
  );
  const files = r.rows.map((u) => ({
    id: u.id, name: u.name, url: '/uploads/' + u.id,
    kind: u.kind, mimetype: u.mimetype, size: u.size, mtime: u.created_at,
  }));
  res.json({ files });
});

api.delete('/uploads/:id', authRequired, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM uploads WHERE id = ?', args: [String(req.params.id)] });
  res.json({ ok: true });
});

// GET /uploads/:id — stream do BLOB
async function serveUpload(req, res) {
  const id = String(req.params.id || req.params[0] || '').replace(/[^a-z0-9-]/gi, '');
  if (!id) return res.status(400).end();
  try {
    await ensureDb();
    const r = await db.execute({
      sql: 'SELECT mimetype, data FROM uploads WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (r.rows.length === 0) return res.status(404).end();
    const row = r.rows[0];
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    res.setHeader('Content-Type', row.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) {
    res.status(500).end();
  }
}
app.get('/uploads/:id', serveUpload);

// ---- Mídia local (pasta fotos/) ------------------------------------------
api.get('/local-media', (req, res) => {
  let files = [];

  // 1) Tenta o manifest estático (gerado no build) — é o caminho que funciona
  //    em qualquer ambiente, inclusive Functions sem acesso ao filesystem.
  const manifestPath = path.join(LOCAL_MEDIA_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest && Array.isArray(manifest.files)) files = manifest.files;
    } catch (e) { /* ignora e cai no readdir */ }
  }

  // 2) Fallback: lê do disco (modo local, npm start).
  if (!files.length && fs.existsSync(LOCAL_MEDIA_DIR)) {
    const raw = fs.readdirSync(LOCAL_MEDIA_DIR)
      .filter(f => !f.startsWith('.') && f !== 'manifest.json' && f.toLowerCase() !== 'readme.md')
      .map(f => {
        const ext = path.extname(f).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov', '.m4v'].includes(ext);
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext);
        if (!isVideo && !isImage) return null;
        return { name: f, kind: isVideo ? 'video' : 'image', shoot: extractShootKey(f) };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    const shootIndex = new Map();
    let idx = 0;
    for (const f of raw) if (!shootIndex.has(f.shoot)) shootIndex.set(f.shoot, idx++);
    files = raw.map((f, i) => ({
      name: f.name,
      url: LOCAL_MEDIA_URL + '/' + encodeURIComponent(f.name),
      kind: f.kind,
      category: SITE_CATEGORIES[(shootIndex.get(f.shoot) || 0) % SITE_CATEGORIES.length],
      featured: i === 0 || raw[i - 1].shoot !== f.shoot,
    }));
  }

  const cat = String(req.query.category || '').trim().toLowerCase();
  const filtered = cat && SITE_CATEGORIES.includes(cat)
    ? files.filter(f => f.category === cat)
    : files;
  res.json({ files: filtered, categories: SITE_CATEGORIES });
});

// ---- Submissões -----------------------------------------------------------
const submitLimiter = rateLimit({ windowMs: 60 * 1000, max: 8 });

api.post('/submissions', submitLimiter, async (req, res) => {
  const b = req.body || {};
  const nome = String(b.nome || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().slice(0, 120);
  if (nome.length < 2) return res.status(400).json({ error: 'invalid_nome' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
  const id = Date.now().toString(36) + '-' + genId(3);
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
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large' });
  }
  res.status(500).json({ error: 'server_error' });
});

app.use('/api', api);

// 404 — só ativo no modo standalone (no Vercel os estáticos vêm do CDN).
if (!IS_VERCEL) {
  app.use((req, res) => {
    if (req.method === 'GET' && req.accepts('html')) {
      return res.status(404).sendFile(path.join(ROOT, 'index.html'));
    }
    res.status(404).json({ error: 'not_found' });
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
if (!IS_VERCEL && require.main === module) {
  ensureDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`✓ Juliana Balbino — http://localhost:${PORT} (${NODE_ENV})`);
        console.log(`  banco: ${process.env.TURSO_DATABASE_URL ? 'Turso/libSQL' : 'SQLite local (./local.db)'}`);
      });
    })
    .catch((err) => {
      console.error('Falha ao inicializar o banco:', err);
      process.exit(1);
    });
}

module.exports = app;
module.exports.default = app;
