/**
 * firestore.js — build-time Firestore REST fetcher with snapshot fallback.
 *
 * Strategy:
 *   1. Try live Firestore REST (no auth — public read).
 *   2. On success, write the parsed result to public/data/snapshot.json
 *      so a future build with Firestore down can still produce a page.
 *   3. On failure, read the bundled snapshot.json fallback.
 *
 * The Firestore REST API returns wrapped values like `{stringValue: "..."}`
 * and `{mapValue: {fields: {...}}}` — `unwrap()` flattens those into plain
 * JS values.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'gmail-auto-techritual';
const COLLECTION = 'article_submissions';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?pageSize=200`;
const TIMEOUT_MS = 10_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, '../../public/data/snapshot.json');

function unwrap(field) {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.nullValue !== undefined) return null;
  if (field.mapValue !== undefined) {
    const out = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      out[k] = unwrap(v);
    }
    return out;
  }
  if (field.arrayValue !== undefined) {
    return (field.arrayValue.values || []).map(unwrap);
  }
  return null;
}

function normalizeDoc(doc) {
  const f = doc.fields || {};
  const meta = unwrap(f.websiteMeta) || {};
  return {
    id: (doc.name || '').split('/').pop(),
    productName: unwrap(f.productName) || '',
    tagline: unwrap(f.tagline) || '',
    websiteUrl: unwrap(f.websiteUrl) || '',
    category: unwrap(f.category) || 'others',
    platforms: unwrap(f.platforms) || '',
    targetUsers: unwrap(f.targetUsers) || '',
    developerName: unwrap(f.developerName) || '',
    developerType: unwrap(f.developerType) || '',
    region: unwrap(f.region) || 'hk',
    featuredImageGcsUrl: unwrap(f.featuredImageGcsUrl) || '',
    appIconUrl: unwrap(f.appIconUrl) || '',
    ogImage: meta.ogImage || '',
    wordpressPostUrl: unwrap(f.wordpressPostUrl) || '',
    publishedAt: unwrap(f.publishedAt) || '',
    status: unwrap(f.status) || ''
  };
}

async function fetchLive() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FIRESTORE_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`Firestore HTTP ${res.status}`);
    const data = await res.json();
    return (data.documents || []).map(normalizeDoc);
  } finally {
    clearTimeout(timeout);
  }
}

async function readSnapshot() {
  try {
    const text = await readFile(SNAPSHOT_PATH, 'utf-8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSnapshot(items) {
  try {
    await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[firestore] snapshot write failed:', e.message);
  }
}

/**
 * Fetch published submissions for the catalogue.
 * Filters: status === 'published' AND wordpressPostUrl set.
 * Sort: newest first.
 */
export async function fetchPublishedSubmissions() {
  let items;
  try {
    const all = await fetchLive();
    items = all
      .filter(s => s.status === 'published' && s.wordpressPostUrl)
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    // Persist for next build's fallback
    await writeSnapshot(items);
    console.log(`[firestore] live fetch ok — ${items.length} published items`);
    return items;
  } catch (e) {
    console.warn(`[firestore] live fetch failed (${e.message}) — using snapshot.json`);
    items = await readSnapshot();
    return items;
  }
}
