/**
 * Username uniqueness store.
 * Persists to a JSON file so names survive process restarts
 * (ephemeral on Railway unless a volume is attached).
 */

import fs from 'fs';
import path from 'path';

const STORE_PATH =
  process.env.USERNAME_STORE_PATH ||
  path.join(process.cwd(), 'data', 'usernames.json');

/** @typedef {{ userId: string, username: string, usernameNormalized: string, createdAt: string, updatedAt: string }} UsernameRecord */

/** @type {Map<string, UsernameRecord>} keyed by userId */
const byUserId = new Map();
/** @type {Map<string, string>} normalized username → userId */
const byNormalized = new Map();

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    const rows = Array.isArray(raw) ? raw : [];
    for (const row of rows) {
      if (!row?.userId || !row?.usernameNormalized) continue;
      byUserId.set(row.userId, row);
      byNormalized.set(row.usernameNormalized, row.userId);
    }
    console.log(`📛 Loaded ${byUserId.size} username(s) from store`);
  } catch (err) {
    console.warn('⚠️  Could not load username store:', err.message);
  }
}

function persist() {
  try {
    ensureDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify([...byUserId.values()], null, 2));
  } catch (err) {
    console.warn('⚠️  Could not persist username store:', err.message);
  }
}

load();

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function validateUsernameFormat(username) {
  const trimmed = String(username || '').trim();
  if (trimmed.length < 3) {
    return { ok: false, error: 'El nombre debe tener al menos 3 caracteres.' };
  }
  if (trimmed.length > 20) {
    return { ok: false, error: 'El nombre no puede superar los 20 caracteres.' };
  }
  if (!/^[a-zA-Z0-9_ ]+$/.test(trimmed)) {
    return { ok: false, error: 'Usa solo letras, números, espacios o guion bajo.' };
  }
  return { ok: true };
}

export function findByUserId(userId) {
  return byUserId.get(userId) || null;
}

export function findByNormalized(normalized) {
  const userId = byNormalized.get(normalized);
  if (!userId) return null;
  return byUserId.get(userId) || null;
}

/**
 * @returns {{ available: boolean, reason?: string, ownerUserId?: string }}
 */
export function checkAvailability(username, selfUserId) {
  const format = validateUsernameFormat(username);
  if (!format.ok) return { available: false, reason: format.error };

  const normalized = normalizeUsername(username);
  const owner = findByNormalized(normalized);
  if (!owner) return { available: true };
  if (selfUserId && owner.userId === selfUserId) return { available: true };
  return { available: false, reason: 'Ese nombre ya está en uso. Elige otro.', ownerUserId: owner.userId };
}

/**
 * @returns {{ ok: boolean, error?: string, record?: UsernameRecord }}
 */
export function setUsername(userId, username) {
  if (!userId || typeof userId !== 'string') {
    return { ok: false, error: 'userId es obligatorio.' };
  }

  const format = validateUsernameFormat(username);
  if (!format.ok) return { ok: false, error: format.error };

  const display = username.trim();
  const normalized = normalizeUsername(display);
  const taken = findByNormalized(normalized);
  if (taken && taken.userId !== userId) {
    return { ok: false, error: 'Ese nombre ya está en uso. Elige otro.' };
  }

  const existing = findByUserId(userId);
  const now = new Date().toISOString();

  if (existing && existing.usernameNormalized !== normalized) {
    byNormalized.delete(existing.usernameNormalized);
  }

  const record = {
    userId,
    username: display,
    usernameNormalized: normalized,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  byUserId.set(userId, record);
  byNormalized.set(normalized, userId);
  persist();
  return { ok: true, record };
}
