// Authentification administrateur : mots de passe hachés (scrypt), sessions en base,
// protection CSRF et limitation des tentatives de connexion.
import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_HOURS = 12;
const COOKIE = 'admin_session';
const IS_PROD = process.env.NODE_ENV === 'production';

// ---------- Mots de passe ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored).split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

// Hash factice pour que la vérification prenne le même temps même si l'e-mail n'existe pas
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.';
  if (pw.length > 200) return 'Mot de passe trop long.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  return null;
}

// ---------- Premier administrateur ----------
export function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (count > 0) return;
  const email = process.env.ADMIN_EMAIL || 'admin@calendrier.local';
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password || passwordProblem(password)) {
    password = crypto.randomBytes(9).toString('base64url') + '7a';
    generated = true;
  }
  db.prepare('INSERT INTO admins (email, pass_hash) VALUES (?, ?)').run(email, hashPassword(password));
  console.log('\n==================================================');
  console.log(' Compte administrateur créé');
  console.log(`  E-mail       : ${email}`);
  console.log(`  Mot de passe : ${generated ? password : '(celui de ADMIN_PASSWORD)'}`);
  console.log(' Changez-le dès la première connexion (onglet Compte).');
  console.log('==================================================\n');
}

// ---------- Limitation des tentatives ----------
const attempts = new Map(); // clé -> { count, first, blockedUntil }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function attemptKeys(ip, email) {
  return [`ip:${ip}`, `email:${String(email).toLowerCase()}`];
}

export function isBlocked(ip, email) {
  const now = Date.now();
  for (const k of attemptKeys(ip, email)) {
    const a = attempts.get(k);
    if (a && a.blockedUntil > now) return Math.ceil((a.blockedUntil - now) / 60000);
  }
  return 0;
}

export function recordFailure(ip, email) {
  const now = Date.now();
  for (const k of attemptKeys(ip, email)) {
    let a = attempts.get(k);
    if (!a || now - a.first > WINDOW_MS) a = { count: 0, first: now, blockedUntil: 0 };
    a.count += 1;
    // l'IP a une tolérance un peu plus large que l'e-mail
    const limit = k.startsWith('ip:') ? MAX_ATTEMPTS * 2 : MAX_ATTEMPTS;
    if (a.count >= limit) a.blockedUntil = now + BLOCK_MS;
    attempts.set(k, a);
  }
}

export function clearFailures(ip, email) {
  for (const k of attemptKeys(ip, email)) attempts.delete(k);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) if (now - a.first > WINDOW_MS && a.blockedUntil < now) attempts.delete(k);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}, 10 * 60 * 1000).unref();

// ---------- Sessions ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function login(email, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email || '').trim());
  const ok = verifyPassword(String(password || ''), admin ? admin.pass_hash : DUMMY_HASH);
  return ok && admin ? admin : null;
}

export function createSession(res, adminId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  db.prepare('INSERT INTO sessions (token_hash, admin_id, csrf, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), adminId, csrf, expires);
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: IS_PROD, path: '/', maxAge: SESSION_HOURS * 3600 * 1000,
  });
  return csrf;
}

export function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

export function destroyAllSessions(adminId) {
  db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(adminId);
}

export function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function currentSession(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const row = db.prepare(
    'SELECT s.csrf, s.expires_at, a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?'
  ).get(sha256(token));
  if (!row || row.expires_at < Date.now()) return null;
  return { adminId: row.id, email: row.email, csrf: row.csrf };
}

// Middleware : exige une session admin valide. Pour les requêtes qui modifient des données,
// exige aussi le jeton CSRF dans l'en-tête X-CSRF-Token.
export function requireAdmin(req, res, next) {
  const s = currentSession(req);
  if (!s) return res.status(401).json({ error: 'Non autorisé' });
  if (!['GET', 'HEAD'].includes(req.method)) {
    const sent = String(req.get('x-csrf-token') || '');
    const a = Buffer.from(sent); const b = Buffer.from(s.csrf);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Jeton de sécurité invalide' });
  }
  req.admin = s;
  next();
}
