#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Gera fotos/manifest.json com a lista completa de mídias e suas categorias.
 * Rode com `npm run build:manifest` (também executado no Vercel via build).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FOTOS_DIR = path.join(ROOT, 'fotos');
const OUT = path.join(FOTOS_DIR, 'manifest.json');
const SITE_CATEGORIES = ['moda', 'bem-estar', 'vida'];

function shootKey(name) {
  const m = /_(\d{9,11})_/.exec(name);
  return m ? m[1] : name;
}

if (!fs.existsSync(FOTOS_DIR)) {
  console.error('Pasta fotos/ não existe.');
  process.exit(0);
}

const raw = fs.readdirSync(FOTOS_DIR)
  .filter((f) => !f.startsWith('.') && f !== 'manifest.json' && f.toLowerCase() !== 'readme.md')
  .map((f) => {
    const ext = path.extname(f).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.mov', '.m4v'].includes(ext);
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext);
    if (!isVideo && !isImage) return null;
    return { name: f, kind: isVideo ? 'video' : 'image', shoot: shootKey(f) };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

const shootIndex = new Map();
let i = 0;
for (const f of raw) if (!shootIndex.has(f.shoot)) shootIndex.set(f.shoot, i++);

const files = raw.map((f, idx) => ({
  name: f.name,
  url: '/fotos/' + encodeURIComponent(f.name),
  kind: f.kind,
  category: SITE_CATEGORIES[shootIndex.get(f.shoot) % SITE_CATEGORIES.length],
  featured: idx === 0 || raw[idx - 1].shoot !== f.shoot,
}));

fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  categories: SITE_CATEGORIES,
  count: files.length,
  files,
}, null, 2));

console.log('✓ manifest.json gerado:', files.length, 'arquivos');
