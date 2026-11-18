// Calendrier de Noël — serveur Cloudflare Worker + base de données D1 (offre gratuite).
import { ADMIN_FILES } from './admin-bundle.js';

// =====================================================================
//  Configuration et valeurs par défaut
// =====================================================================
const ICONS = ['etoile', 'boule', 'sapin', 'cadeau', 'cloche', 'sucre-orge', 'houx', 'flocon', 'chaussette', 'bougie', 'couronne', 'bonhomme'];

const DEFAULT_REWARDS = [
  '1H avec moi', 'Émoticônes', 'SKIN 800', 'Danse FTN', '1H avec moi', 'Émoticônes', '1H avec moi', 'Danse FTN',
  '1H avec moi', 'Émoticônes', 'VIP', 'Danse FTN', '1H avec moi', 'Émoticônes', 'Vidéo IA', '1H avec moi',
  'VIP', 'Émoticônes', 'VIP', 'Vidéo IA x1', 'SKIN 800', 'Passe de combat prochaine saison',
  'Figurine Pop One Piece', 'Peluche TikTok',
];

const DEFAULT_SETTINGS = {
  app_name: 'Calendrier de Noël',
  subtitle: 'Une surprise par jour, du 1er au 24 décembre',
  year: '2026',
  timezone: 'Europe/Paris',
  test_date: '',
  footer_text: 'Reviens chaque jour pour découvrir la surprise du jour 🎄',
  participation_open: '1',
  // Règles des tickets
  heart_t1_max: '9', heart_t1_mult: '1',
  heart_t2_max: '19', heart_t2_mult: '2',
  heart_t3_max: '50', heart_t3_mult: '3',
  superfan_bonus: '20',
  coins_per_ticket: '200',
  rules_intro: 'Pour vous remercier de votre présence, de votre soutien et de votre fidélité sur les lives, j’ai décidé de mettre en place un calendrier de l’Avent avec des récompenses à gagner tout au long du mois de décembre !',
  music_enabled: '1',
  music_url: '',
  music_track: 'ambiance',
  creator_name: 'MXOU',
  tiktok_url: 'https://www.tiktok.com/@maxousurfortnite',
  discord_url: 'https://discord.gg/UxfcmGM9H',
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases (day INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', reward TEXT NOT NULL DEFAULT '', subtitle TEXT NOT NULL DEFAULT '', accent TEXT NOT NULL DEFAULT 'or', image_url TEXT NOT NULL DEFAULT '', link_url TEXT NOT NULL DEFAULT '', link_label TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS participations (id INTEGER PRIMARY KEY AUTOINCREMENT, day INTEGER NOT NULL, pseudo TEXT NOT NULL, hearts INTEGER NOT NULL DEFAULT 0, top_fan INTEGER NOT NULL DEFAULT 0, tickets INTEGER NOT NULL DEFAULT 1, ticket_code TEXT NOT NULL UNIQUE, visitor_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'attente', coins INTEGER NOT NULL DEFAULT 0, bonus INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE UNIQUE INDEX IF NOT EXISTS uniq_part_pseudo ON participations(day, pseudo COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_part_visitor ON participations(day, visitor_id);
CREATE TABLE IF NOT EXISTS visits (date TEXT NOT NULL, visitor_id TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (date, visitor_id));
CREATE TABLE IF NOT EXISTS draws (id INTEGER PRIMARY KEY AUTOINCREMENT, day INTEGER NOT NULL, participation_id INTEGER NOT NULL, pseudo TEXT NOT NULL, ticket_code TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0, manual INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS opens (day INTEGER NOT NULL, date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, date));
CREATE TABLE IF NOT EXISTS case_opens (day INTEGER NOT NULL, visitor_id TEXT NOT NULL, opened_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (day, visitor_id));
CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, first INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0);
`;

const SESSION_MS = 12 * 3600 * 1000;
const PBKDF2_ITER = 20000;
const STATUSES = ['attente', 'validee', 'refusee'];
const MUSIC_TRACKS = ['ambiance', 'jinglelive', 'deckhalls', 'wewish', 'jingle', 'doucenuit'];
const ACCENTS = ['rouge', 'vert', 'violet', 'noir', 'bleu', 'or'];
// Présentation des lots comme dans la vidéo : sous-titre (pastille), couleur, photo
const REWARD_STYLE = {
  '1h avec moi': ['Une heure rien que pour toi', 'rouge'],
  'émoticônes': ['Des émoticônes rien que pour toi', 'or'],
  'skin 800': ['Un skin à 800', 'vert'],
  'danse ftn': ['Une danse Fortnite', 'bleu'],
  'vip': ['Statut VIP', 'noir'],
  'vidéo ia': ['Ta vidéo IA perso', 'violet'],
  'vidéo ia x1': ['Ta vidéo IA perso', 'violet'],
};
const SPECIAL_DAYS = {
  22: { reward: 'Passe de combat', subtitle: 'Prochaine saison', image: '/img/passe-de-combat.webp', old: 'Passe de combat prochaine saison' },
  23: { reward: 'Figurine Pop', subtitle: 'One Piece', image: '/img/figurine-pop.webp', old: 'Figurine Pop One Piece' },
  24: { reward: 'Peluche TikTok', subtitle: 'La dernière case', image: '/img/peluche-tiktok.webp', old: 'Peluche TikTok' },
};

// =====================================================================
//  Utilitaires
// =====================================================================
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

function safeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${hex(salt)}$${hex(await pbkdf2(pw, salt, PBKDF2_ITER))}`;
}
async function verifyPassword(pw, stored) {
  const [algo, iter, salt, h] = String(stored).split('$');
  if (algo !== 'pbkdf2') return false;
  return safeEqual(hex(await pbkdf2(pw, fromHex(salt), Number(iter))), h);
}

function codeProblem(code) {
  if (typeof code !== 'string' || code.trim().length < 8) return 'Le code doit contenir au moins 8 caractères.';
  if (code.length > 100) return 'Code trop long.';
  return null;
}

const clean = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
function cleanUrl(v) {
  const s = clean(v, 500);
  if (!s) return '';
  try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : null; } catch { return null; }
}

function readCookie(req, name) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function cookie(name, value, { maxAge, sameSite = 'Strict', httpOnly = true } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge / 1000)}`;
  return c;
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; media-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

class Res {
  constructor() { this.cookies = []; }
  setCookie(c) { this.cookies.push(c); }
  build(body, status, type, extra = {}) {
    const h = new Headers({ ...SECURITY_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': type, ...extra });
    for (const c of this.cookies) h.append('Set-Cookie', c);
    return new Response(body, { status, headers: h });
  }
  json(data, status = 200) { return this.build(JSON.stringify(data), status, 'application/json; charset=utf-8'); }
  error(msg, status) { return this.json({ error: msg }, status); }
  redirect(to) { return this.build(null, 302, 'text/plain', { Location: to }); }
}

// =====================================================================
//  Base de données
// =====================================================================
let ready = null;
async function init(env) {
  const db = env.DB;
  await db.exec(SCHEMA.trim());
  const stmts = Object.entries(DEFAULT_SETTINGS).map(([k, v]) => db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(k, v));
  for (let d = 1; d <= 24; d++) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO cases (day, title, message, reward, icon) VALUES (?, ?, ?, ?, ?)').bind(
      d, `Case du ${d} décembre`, 'Bravo, tu as ouvert la case du jour ! Active ta récompense pour recevoir ton ticket de participation.',
      DEFAULT_REWARDS[d - 1], ICONS[(d - 1) % ICONS.length]));
  }
  await db.batch(stmts);
  // Mise à jour d'une base créée avec une version précédente
  for (const sql of [
    "ALTER TABLE participations ADD COLUMN status TEXT NOT NULL DEFAULT 'attente'",
    'ALTER TABLE draws ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE draws ADD COLUMN seen INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE draws ADD COLUMN manual INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE participations ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE participations ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE cases ADD COLUMN subtitle TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE cases ADD COLUMN accent TEXT NOT NULL DEFAULT 'or'",
  ]) { try { await db.prepare(sql).run(); } catch { /* colonne déjà présente */ } }
  // Mise à jour v4 (une seule fois) : musique de la vidéo + présentation des lots comme dans la vidéo
  if (!(await db.prepare("SELECT 1 AS x FROM settings WHERE key = 'admin_v4'").first())) {
    const upd = [
      db.prepare("UPDATE settings SET value = 'jinglelive' WHERE key = 'music_track'"),
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_v4', '1')"),
    ];
    const { results: cs } = await db.prepare('SELECT day, reward, subtitle, image_url FROM cases').all();
    for (const c of cs) {
      const sp = SPECIAL_DAYS[c.day];
      if (sp && c.reward === sp.old) {
        upd.push(db.prepare("UPDATE cases SET reward = ?, subtitle = ?, accent = 'or', image_url = CASE WHEN image_url = '' THEN ? ELSE image_url END WHERE day = ?").bind(sp.reward, sp.subtitle, sp.image, c.day));
      } else if (!c.subtitle) {
        const st = REWARD_STYLE[String(c.reward).trim().toLowerCase()];
        if (st) upd.push(db.prepare('UPDATE cases SET subtitle = ?, accent = ? WHERE day = ?').bind(st[0], st[1], c.day));
      }
    }
    await db.batch(upd);
  }

  // Mise à jour v5 (une seule fois) : nouvelle musique d'ambiance
  if (!(await db.prepare("SELECT 1 AS x FROM settings WHERE key = 'admin_v5'").first())) {
    await db.batch([
      db.prepare("UPDATE settings SET value = 'ambiance' WHERE key = 'music_track'"),
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_v5', '1')"),
    ]);
  }

  // Code administrateur : vient du secret Cloudflare ADMIN_CODE (ou ADMIN_PASSWORD).
  // Si le secret change, le code est remplacé. Sinon, le code choisi dans l'onglet Compte est gardé.
  const seed = env.ADMIN_CODE || env.ADMIN_PASSWORD;
  if (seed && !codeProblem(seed)) {
    const seedHash = await sha256(`seed:${seed}`);
    const applied = await db.prepare("SELECT value FROM settings WHERE key = 'admin_seed'").first();
    const admin = await db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').first();
    if (!admin) {
      await db.prepare('INSERT INTO admins (email, pass_hash) VALUES (?, ?)').bind(String(env.ADMIN_EMAIL || 'admin').trim(), await hashPassword(seed)).run();
    } else if (!applied || applied.value !== seedHash) {
      await db.batch([
        db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').bind(await hashPassword(seed), admin.id),
        db.prepare('DELETE FROM sessions'),
      ]);
    }
    if (!applied || applied.value !== seedHash) {
      await db.prepare("INSERT INTO settings (key, value) VALUES ('admin_seed', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(seedHash).run();
    }
  }
}

async function getSettings(db) {
  const { results } = await db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE 'admin_%'").all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

function todayInTimezone(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function calendarToday(s) {
  let tz = s.timezone || 'Europe/Paris';
  try { new Intl.DateTimeFormat('fr', { timeZone: tz }); } catch { tz = 'Europe/Paris'; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s.test_date || '') ? s.test_date : todayInTimezone(tz);
  const [y, m, d] = date.split('-').map(Number);
  const year = Number(s.year);
  let status;
  if (y < year || (y === year && m < 12)) status = 'avant';
  else if (y === year && m === 12 && d <= 24) status = 'pendant';
  else status = 'apres';
  return { date, day: status === 'pendant' ? d : null, status, testMode: Boolean(s.test_date) };
}

// Instant (en ms) correspondant à minuit, heure locale du fuseau, pour une date donnée
function localMidnight(tz, y, m, d) {
  const guess = Date.UTC(y, m - 1, d);
  const offsetAt = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return t;
}
// Prochaine ouverture : le 1er décembre avant le début, sinon minuit prochain (vraie heure)
function nextUnlock(s, t) {
  let tz = s.timezone || 'Europe/Paris';
  try { new Intl.DateTimeFormat('fr', { timeZone: tz }); } catch { tz = 'Europe/Paris'; }
  const year = Number(s.year);
  if (t.status === 'avant') return { at: localMidnight(tz, year, 12, 1), day: 1 };
  if (t.status === 'pendant' && t.day < 24) {
    const [y, m, d] = todayInTimezone(tz).split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return { at: localMidnight(tz, next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()), day: t.day + 1 };
  }
  return null;
}

// Limitation des tentatives (stockée en base, fonctionne sur tous les serveurs Cloudflare)
async function hit(db, key, limit, windowMs, blockMs) {
  const now = Date.now();
  let row = await db.prepare('SELECT * FROM limits WHERE key = ?').bind(key).first();
  if (!row || now - row.first > windowMs) row = { count: 0, first: now, blocked_until: 0 };
  row.count += 1;
  if (row.count >= limit) row.blocked_until = now + blockMs;
  await db.prepare('INSERT INTO limits (key, count, first, blocked_until) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, first = excluded.first, blocked_until = excluded.blocked_until')
    .bind(key, row.count, row.first, row.blocked_until).run();
}
async function blockedMinutes(db, keys) {
  const now = Date.now();
  for (const k of keys) {
    const row = await db.prepare('SELECT blocked_until FROM limits WHERE key = ?').bind(k).first();
    if (row && row.blocked_until > now) return Math.ceil((row.blocked_until - now) / 60000);
  }
  return 0;
}

// =====================================================================
//  Sessions administrateur
// =====================================================================
async function currentSession(req, db) {
  const token = readCookie(req, 'admin_session');
  if (!token) return null;
  const row = await db.prepare('SELECT s.csrf, s.expires_at, a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?')
    .bind(await sha256(token)).first();
  if (!row || row.expires_at < Date.now()) return null;
  return { adminId: row.id, email: row.email, csrf: row.csrf };
}

// =====================================================================
//  Routes
// =====================================================================
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function ticketCode(day) {
  let r = '';
  for (const b of crypto.getRandomValues(new Uint8Array(5))) r += CODE_CHARS[b % CODE_CHARS.length];
  return `J${String(day).padStart(2, '0')}-${r}`;
}
// Règles : Cœur du jour par paliers (niveau × multiplicateur du palier), Super Fan, pièces, mérite
function ticketRules(s) {
  const n = (k, d) => { const v = Number(s[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  return {
    tiers: [[n('heart_t1_max', 9), n('heart_t1_mult', 1)], [n('heart_t2_max', 19), n('heart_t2_mult', 2)], [n('heart_t3_max', 50), n('heart_t3_mult', 3)]],
    superfan: n('superfan_bonus', 20),
    coinsPer: n('coins_per_ticket', 200),
  };
}
function computeTickets(s, level, superFan, coins, bonus = 0) {
  const r = ticketRules(s);
  const tier = r.tiers.find(([max]) => level <= max) || r.tiers[r.tiers.length - 1];
  const fromHearts = level * tier[1];
  const fromFan = superFan ? r.superfan : 0;
  const fromCoins = r.coinsPer > 0 ? Math.floor(coins / r.coinsPer) : 0;
  return Math.max(1, fromHearts + fromFan + fromCoins + bonus);
}
function maxHeartLevel(s) { return ticketRules(s).tiers[2][0] || 50; }
function cleanImage(v) {
  const t = clean(v, 500);
  if (/^\/img\/[a-z0-9._-]+$/i.test(t)) return t;   // photo fournie avec le site
  return cleanUrl(t);
}
function randomInt(max) {
  // entier aléatoire uniforme dans [0, max)
  const limit = Math.floor(0xffffffff / max) * max;
  let x;
  do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= limit);
  return x % max;
}

function visitorId(req, res) {
  let vid = readCookie(req, 'vid');
  if (!vid || !/^[A-Za-z0-9_-]{20,40}$/.test(vid)) {
    vid = randomToken(18);
    res.setCookie(cookie('vid', vid, { maxAge: 365 * 86400 * 1000, sameSite: 'Lax' }));
  }
  return vid;
}

async function readJson(req) {
  try { const t = await req.text(); return t.length > 50000 ? {} : JSON.parse(t || '{}'); } catch { return {}; }
}

async function handleApi(req, env, url, res) {
  const db = env.DB;
  const p = url.pathname;
  const m = req.method;
  const ip = req.headers.get('cf-connecting-ip') || 'inconnu';

  if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    if (!(req.headers.get('content-type') || '').includes('application/json')) return res.error('Format non accepté', 415);
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return res.error('Origine refusée', 403);
  }

  // ---------------- Public ----------------
  if (p === '/api/calendar' && m === 'GET') {
    const s = await getSettings(db);
    const t = calendarToday(s);
    const vid = visitorId(req, res);
    const isAdmin = Boolean(await currentSession(req, db));
    const [, icons, wins, counts, myOpens] = await db.batch([
      db.prepare('INSERT INTO visits (date, visitor_id) VALUES (?, ?) ON CONFLICT(date, visitor_id) DO UPDATE SET views = views + 1').bind(t.date, vid),
      db.prepare('SELECT day, icon FROM cases ORDER BY day'),
      // Gains confirmés de ce visiteur, pas encore annoncés
      db.prepare(`SELECT d.id, d.day, d.pseudo, c.reward FROM draws d JOIN participations p ON p.id = d.participation_id JOIN cases c ON c.day = d.day
        WHERE p.visitor_id = ? AND d.confirmed = 1 AND d.seen = 0 AND d.manual = 0 ORDER BY d.day`).bind(vid),
      db.prepare("SELECT day, COUNT(*) AS n FROM participations WHERE status != 'refusee' GROUP BY day"),
      db.prepare('SELECT day FROM case_opens WHERE visitor_id = ?').bind(vid),
    ]);
    const opened = new Set(myOpens.results.map((r) => r.day));
    const countMap = isAdmin ? Object.fromEntries(counts.results.map((r) => [r.day, r.n])) : null;
    return res.json({
      appName: s.app_name, subtitle: s.subtitle, footer: s.footer_text,
      musicEnabled: s.music_enabled === '1', musicUrl: s.music_url || '', musicTrack: s.music_track || 'ambiance',
      now: Date.now(), next: nextUnlock(s, t),
      admin: isAdmin, creatorName: s.creator_name || 'MXOU', wins: wins.results,
      rules: { ...ticketRules(s), intro: s.rules_intro || '' },
      socials: { tiktok: s.tiktok_url || '', discord: s.discord_url || '' },
      year: Number(s.year), status: t.status, today: t.day,
      cases: icons.results.map((c) => ({
        day: c.day, icon: c.icon, opened: opened.has(c.day), ...(isAdmin ? { participants: countMap[c.day] || 0 } : {}),
        state: t.day === null ? (t.status === 'apres' ? 'passee' : 'future') : c.day === t.day ? 'aujourdhui' : c.day < t.day ? 'passee' : 'future',
      })),
    });
  }

  let mm;
  if ((mm = p.match(/^\/api\/open\/(\d+)$/)) && m === 'POST') {
    const day = Number(mm[1]);
    const s = await getSettings(db);
    const t = calendarToday(s);
    if (day < 1 || day > 24) return res.error('Case invalide', 400);
    const isAdmin = Boolean(await currentSession(req, db));
    if (t.day !== day && !isAdmin) {
      const msg = t.day === null
        ? (t.status === 'avant' ? 'Le calendrier commence le 1er décembre !' : 'Le calendrier est terminé. Joyeux Noël !')
        : day < t.day ? 'Cette case est passée : seule la case du jour peut être ouverte.' : 'Patience ! Cette case n’est pas encore disponible.';
      return res.error(msg, 403);
    }
    const vid = visitorId(req, res);
    const isToday = t.day === day;
    // Une seule ouverture par viewer et par case : la 1re est enregistrée, les suivantes
    // ne rejouent pas l'ouverture (le viewer peut seulement revoir sa case et son ticket).
    let alreadyOpened = false;
    if (!isAdmin) {
      const r = await db.prepare('INSERT OR IGNORE INTO case_opens (day, visitor_id) VALUES (?, ?)').bind(day, vid).run();
      alreadyOpened = (r.meta?.changes ?? 1) === 0;
    }
    const queries = [
      db.prepare('SELECT day, title, message, reward, subtitle, accent, image_url, link_url, link_label FROM cases WHERE day = ?').bind(day),
      db.prepare('SELECT pseudo, tickets, ticket_code, status FROM participations WHERE day = ? AND visitor_id = ?').bind(day, vid),
    ];
    // Statistiques : seules les premières ouvertures des viewers sont comptées (pas l'admin)
    if (!isAdmin && !alreadyOpened) queries.push(db.prepare('INSERT INTO opens (day, date, count) VALUES (?, ?, 1) ON CONFLICT(day, date) DO UPDATE SET count = count + 1').bind(day, t.date));
    const [c, mine] = await db.batch(queries);
    return res.json({
      ...c.results[0], preview: !isToday, already_opened: alreadyOpened, now: Date.now(), next: nextUnlock(s, t),
      participation_open: (isToday && s.participation_open === '1') || isAdmin,
      admin: isAdmin,
      my_participation: mine.results[0] || null,
    });
  }

  if (p === '/api/wins/seen' && m === 'POST') {
    const vid = visitorId(req, res);
    await db.prepare(`UPDATE draws SET seen = 1 WHERE confirmed = 1 AND participation_id IN (SELECT id FROM participations WHERE visitor_id = ?)`).bind(vid).run();
    return res.json({ ok: true });
  }

  if ((mm = p.match(/^\/api\/participate\/(\d+)$/)) && m === 'POST') {
    const day = Number(mm[1]);
    const s = await getSettings(db);
    const t = calendarToday(s);
    // Un administrateur peut créer des tickets pour n'importe quelle case (tests, ajouts)
    const isAdmin = Boolean(await currentSession(req, db));
    if (day < 1 || day > 24) return res.error('Case invalide', 400);
    if (!isAdmin) {
      if (t.day !== day) return res.error('Tu ne peux participer qu’à la case du jour.', 403);
      if (s.participation_open !== '1') return res.error('Les participations sont fermées pour le moment.', 403);
      if (await blockedMinutes(db, [`part:${ip}`])) return res.error('Trop de tentatives, réessaie plus tard.', 429);
      await hit(db, `part:${ip}`, 20, 3600 * 1000, 3600 * 1000);
    }

    const b = await readJson(req);
    const pseudo = clean(b.pseudo, 40).replace(/^@+/, '');
    if (!/^[A-Za-z0-9._]{2,24}$/.test(pseudo)) return res.error('Pseudo TikTok invalide (lettres, chiffres, points et _ uniquement, 2 à 24 caractères).', 400);
    const hearts = Number(b.hearts);
    const maxLvl = maxHeartLevel(s);
    if (!Number.isInteger(hearts) || hearts < 1 || hearts > maxLvl) return res.error(`Indique le niveau de ton Cœur du jour (obligatoire, de 1 à ${maxLvl}).`, 400);
    const topFan = b.top_fan === true;
    const coins = b.coins === '' || b.coins == null ? 0 : Number(b.coins);
    if (!Number.isInteger(coins) || coins < 0 || coins > 10000000) return res.error('Nombre de pièces invalide.', 400);
    if (b.certify !== true) return res.error('Tu dois certifier que tes informations sont exactes.', 400);

    // Pour l'admin, chaque ticket a son propre identifiant (il peut en créer plusieurs)
    const vid = isAdmin ? `admin-${randomToken(12)}` : visitorId(req, res);
    const already = isAdmin ? null : await db.prepare('SELECT pseudo, tickets, ticket_code, status FROM participations WHERE day = ? AND visitor_id = ?').bind(day, vid).first();
    if (already) return res.json({ error: 'Tu as déjà activé ta récompense aujourd’hui.', my_participation: already }, 409);
    if (await db.prepare('SELECT 1 AS x FROM participations WHERE day = ? AND pseudo = ? COLLATE NOCASE').bind(day, pseudo).first()) {
      return res.error(isAdmin ? 'Ce pseudo a déjà un ticket pour cette case.' : 'Ce pseudo a déjà participé aujourd’hui.', 409);
    }
    const tickets = computeTickets(s, hearts, topFan, coins);
    for (let i = 0; i < 5; i++) {
      const code = ticketCode(day);
      try {
        await db.prepare('INSERT INTO participations (day, pseudo, hearts, top_fan, coins, tickets, ticket_code, visitor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(day, pseudo, hearts, topFan ? 1 : 0, coins, tickets, code, vid).run();
        return res.json({ ok: true, my_participation: { pseudo, tickets, ticket_code: code, status: 'attente' } });
      } catch (e) {
        if (!String(e.message).includes('ticket_code')) return res.error('Participation déjà enregistrée pour aujourd’hui.', 409);
      }
    }
    return res.error('Erreur, réessaie.', 500);
  }

  // ---------------- Connexion admin ----------------
  if (p === '/api/admin/login' && m === 'POST') {
    const b = await readJson(req);
    const code = String(b.code ?? '').trim().slice(0, 100);
    const keys = [`login-ip:${ip}`, 'login-global'];
    const wait = await blockedMinutes(db, keys);
    if (wait) return res.error(`Trop de tentatives. Réessaie dans ${wait} min.`, 429);
    const admin = await db.prepare('SELECT * FROM admins ORDER BY id LIMIT 1').first();
    if (!admin) return res.error('Aucun code administrateur n’est configuré (secret ADMIN_CODE dans Cloudflare).', 503);
    if (!code || !(await verifyPassword(code, admin.pass_hash))) {
      await hit(db, keys[0], 5, 15 * 60000, 15 * 60000);
      await hit(db, keys[1], 50, 60 * 60000, 15 * 60000);
      return res.error('Code incorrect.', 401);
    }
    await db.prepare('DELETE FROM limits WHERE key = ?').bind(keys[0]).run();
    const token = randomToken(32), csrf = randomToken(24);
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
      db.prepare('INSERT INTO sessions (token_hash, admin_id, csrf, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), admin.id, csrf, Date.now() + SESSION_MS),
    ]);
    res.setCookie(cookie('admin_session', token, { maxAge: SESSION_MS }));
    return res.json({ ok: true, csrf });
  }

  // ---------------- Routes admin protégées ----------------
  if (p.startsWith('/api/admin/')) {
    const sess = await currentSession(req, db);
    if (!sess) return res.error('Non autorisé', 401);
    if (!['GET', 'HEAD'].includes(m) && !safeEqual(req.headers.get('x-csrf-token') || '', sess.csrf)) {
      return res.error('Jeton de sécurité invalide', 403);
    }
    return adminRoutes(req, db, p, m, sess, res, url);
  }

  return res.error('Introuvable', 404);
}

async function adminRoutes(req, db, p, m, sess, res, url) {
  let mm;
  if (p === '/api/admin/logout' && m === 'POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(readCookie(req, 'admin_session'))).run();
    res.setCookie(cookie('admin_session', '', { maxAge: 0 }));
    return res.json({ ok: true });
  }
  if (p === '/api/admin/me' && m === 'GET') return res.json({ csrf: sess.csrf });

  if (p === '/api/admin/cases' && m === 'GET') {
    const { results } = await db.prepare('SELECT * FROM cases ORDER BY day').all();
    return res.json({ cases: results, icons: ICONS });
  }
  if ((mm = p.match(/^\/api\/admin\/cases\/(\d+)$/)) && m === 'PUT') {
    const day = Number(mm[1]);
    if (day < 1 || day > 24) return res.error('Case invalide', 400);
    const b = await readJson(req);
    const image_url = cleanImage(b.image_url), link_url = cleanUrl(b.link_url);
    if (image_url === null) return res.error('Lien d’image invalide (doit commencer par https://)', 400);
    if (link_url === null) return res.error('Lien invalide (doit commencer par https://)', 400);
    const icon = ICONS.includes(b.icon) ? b.icon : ICONS[0];
    const accent = ACCENTS.includes(b.accent) ? b.accent : 'or';
    await db.prepare(`UPDATE cases SET title = ?, message = ?, reward = ?, subtitle = ?, accent = ?, image_url = ?, link_url = ?, link_label = ?, icon = ?, updated_at = datetime('now') WHERE day = ?`)
      .bind(clean(b.title, 120), clean(b.message, 3000), clean(b.reward, 300), clean(b.subtitle, 80), accent, image_url, link_url, clean(b.link_label, 60), icon, day).run();
    return res.json({ ok: true, case: await db.prepare('SELECT * FROM cases WHERE day = ?').bind(day).first() });
  }

  if (p === '/api/admin/settings' && m === 'GET') {
    const s = await getSettings(db);
    return res.json({ settings: s, today: calendarToday(s) });
  }
  if (p === '/api/admin/settings' && m === 'PUT') {
    const b = await readJson(req);
    const year = Number(b.year);
    if (!Number.isInteger(year) || year < 2024 || year > 2100) return res.error('Année invalide', 400);
    const test = clean(b.test_date, 10);
    if (test && !/^\d{4}-\d{2}-\d{2}$/.test(test)) return res.error('Date de test invalide', 400);
    const tz = clean(b.timezone, 60) || 'Europe/Paris';
    try { new Intl.DateTimeFormat('fr', { timeZone: tz }); } catch { return res.error('Fuseau horaire invalide', 400); }
    const name = clean(b.app_name, 80);
    if (!name) return res.error('Le nom du calendrier est obligatoire', 400);
    const socialUrl = (v) => { const u = cleanUrl(v); return u && u.startsWith('https://') ? u : ''; };
    const musicUrl = cleanUrl(b.music_url);
    if (musicUrl === null || (musicUrl && !musicUrl.startsWith('https://'))) return res.error('Le lien de la musique doit commencer par https://', 400);
    const int = (v, min, max, def) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? String(n) : String(def); };
    const values = {
      app_name: name, subtitle: clean(b.subtitle, 200), footer_text: clean(b.footer_text, 300), year: String(year), timezone: tz, test_date: test,
      participation_open: b.participation_open ? '1' : '0', music_enabled: b.music_enabled ? '1' : '0', music_url: musicUrl,
      music_track: MUSIC_TRACKS.includes(b.music_track) ? b.music_track : 'ambiance',
      creator_name: clean(b.creator_name, 40) || 'MXOU',
      tiktok_url: socialUrl(b.tiktok_url), discord_url: socialUrl(b.discord_url),
      heart_t1_max: int(b.heart_t1_max, 1, 1000, 9), heart_t1_mult: int(b.heart_t1_mult, 0, 1000, 1),
      heart_t2_max: int(b.heart_t2_max, 1, 1000, 19), heart_t2_mult: int(b.heart_t2_mult, 0, 1000, 2),
      heart_t3_max: int(b.heart_t3_max, 1, 1000, 50), heart_t3_mult: int(b.heart_t3_mult, 0, 1000, 3),
      superfan_bonus: int(b.superfan_bonus, 0, 100000, 20), coins_per_ticket: int(b.coins_per_ticket, 0, 1000000, 200),
      rules_intro: clean(b.rules_intro, 1000),
    };
    await db.batch(Object.entries(values).map(([k, v]) =>
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v)));
    const s = await getSettings(db);
    return res.json({ ok: true, settings: s, today: calendarToday(s) });
  }

  if (p === '/api/admin/stats' && m === 'GET') {
    const s = await getSettings(db);
    const t = calendarToday(s);
    const r = await db.batch([
      db.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits'),
      db.prepare('SELECT COALESCE(SUM(views),0) AS n FROM visits'),
      db.prepare('SELECT COUNT(*) AS n FROM visits WHERE date = ?').bind(t.date),
      db.prepare('SELECT COUNT(DISTINCT pseudo COLLATE NOCASE) AS n FROM participations'),
      db.prepare('SELECT COUNT(*) AS n FROM participations'),
      db.prepare('SELECT COALESCE(SUM(tickets),0) AS n FROM participations'),
      db.prepare("SELECT COUNT(*) AS n FROM participations WHERE status = 'attente'"),
      db.prepare("SELECT COUNT(*) AS n FROM participations WHERE status = 'validee'"),
      db.prepare('SELECT date, COUNT(*) AS visitors, SUM(views) AS views FROM visits GROUP BY date ORDER BY date DESC LIMIT 60'),
      db.prepare(`SELECT c.day, c.reward,
          (SELECT COUNT(*) FROM participations p WHERE p.day = c.day) AS participants,
          (SELECT COUNT(*) FROM participations p WHERE p.day = c.day AND p.status = 'validee') AS validated,
          (SELECT COUNT(*) FROM participations p WHERE p.day = c.day AND p.status = 'attente') AS pending,
          (SELECT COALESCE(SUM(tickets),0) FROM participations p WHERE p.day = c.day) AS tickets,
          (SELECT COALESCE(SUM(count),0) FROM opens o WHERE o.day = c.day) AS opens,
          (SELECT GROUP_CONCAT(pseudo, ', ') FROM draws d WHERE d.day = c.day AND d.confirmed = 1) AS winner
        FROM cases c ORDER BY c.day`),
    ]);
    const n = (i) => r[i].results[0].n;
    return res.json({
      today: t,
      totals: { visitors: n(0), views: n(1), visitorsToday: n(2), participants: n(3), participations: n(4), tickets: n(5), pending: n(6), validated: n(7) },
      visitsByDate: r[8].results, byDay: r[9].results,
    });
  }

  if (p === '/api/admin/participations' && m === 'GET') {
    const day = Number(url.searchParams.get('day'));
    const status = url.searchParams.get('status');
    const where = [], args = [];
    if (Number.isInteger(day) && day >= 1 && day <= 24) { where.push('day = ?'); args.push(day); }
    if (STATUSES.includes(status)) { where.push('status = ?'); args.push(status); }
    const sql = `SELECT id, day, pseudo, hearts, top_fan, coins, bonus, tickets, ticket_code, status, created_at FROM participations
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 5000`;
    return res.json({ participations: (await db.prepare(sql).bind(...args).all()).results });
  }
  if (p === '/api/admin/participations.csv' && m === 'GET') {
    const { results } = await db.prepare('SELECT day, pseudo, hearts, top_fan, coins, bonus, tickets, ticket_code, status, created_at FROM participations ORDER BY day, id').all();
    const label = { attente: 'En attente', validee: 'Validée', refusee: 'Refusée' };
    const esc = (v) => { let x = String(v ?? ''); if (/^[=+\-@]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; };
    const lines = ['Jour;Pseudo TikTok;Niveau Coeur du jour;Super Fan;Pieces;Tickets merite;Tickets total;Code ticket;Statut;Date (UTC)']
      .concat(results.map((r) => [r.day, r.pseudo, r.hearts, r.top_fan ? 'Oui' : 'Non', r.coins, r.bonus, r.tickets, r.ticket_code, label[r.status] || r.status, r.created_at].map(esc).join(';')));
    return res.build('﻿' + lines.join('\r\n'), 200, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="participations.csv"' });
  }
  if ((mm = p.match(/^\/api\/admin\/participations\/(\d+)$/)) && m === 'PUT') {
    const b = await readJson(req);
    const id = Number(mm[1]);
    const cur = await db.prepare('SELECT * FROM participations WHERE id = ?').bind(id).first();
    if (!cur) return res.error('Participation introuvable', 404);
    if (b.status !== undefined && !STATUSES.includes(b.status)) return res.error('Statut invalide', 400);
    const s = await getSettings(db);
    const int = (v, d, min, max) => { if (v === undefined || v === '') return d; const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
    const hearts = int(b.hearts, cur.hearts, 0, 1000), coins = int(b.coins, cur.coins, 0, 10000000), bonus = int(b.bonus, cur.bonus, -100000, 100000);
    if (hearts === null || coins === null || bonus === null) return res.error('Valeur invalide', 400);
    const topFan = b.top_fan === undefined ? Boolean(cur.top_fan) : b.top_fan === true;
    const tickets = computeTickets(s, hearts, topFan, coins, bonus);
    await db.prepare('UPDATE participations SET status = ?, hearts = ?, top_fan = ?, coins = ?, bonus = ?, tickets = ? WHERE id = ?')
      .bind(b.status ?? cur.status, hearts, topFan ? 1 : 0, coins, bonus, tickets, id).run();
    return res.json({ ok: true, participation: await db.prepare('SELECT id, day, pseudo, hearts, top_fan, coins, bonus, tickets, ticket_code, status, created_at FROM participations WHERE id = ?').bind(id).first() });
  }
  if (p === '/api/admin/participations/validate-all' && m === 'POST') {
    const b = await readJson(req);
    const day = Number(b.day);
    if (!Number.isInteger(day) || day < 1 || day > 24) return res.error('Choisis un jour', 400);
    const r = await db.prepare("UPDATE participations SET status = 'validee' WHERE day = ? AND status = 'attente'").bind(day).run();
    return res.json({ ok: true, changed: r.meta?.changes ?? 0 });
  }
  if ((mm = p.match(/^\/api\/admin\/participations\/(\d+)$/)) && m === 'DELETE') {
    await db.prepare('DELETE FROM participations WHERE id = ?').bind(Number(mm[1])).run();
    return res.json({ ok: true });
  }

  // Liste des pseudos pour la roue : participations du jour (+ ajouts manuels)
  async function wheelEntries(day, b) {
    const onlyValidated = b.validated_only !== false;
    let rows = [];
    if (b.include_auto !== false) {
      rows = (await db.prepare(`SELECT id, pseudo, tickets, ticket_code FROM participations WHERE day = ?${onlyValidated ? " AND status = 'validee'" : " AND status != 'refusee'"} ORDER BY id`).bind(day).all()).results;
    }
    const seen = new Set(rows.map((r) => r.pseudo.toLowerCase()));
    // Ajouts manuels : { pseudo, tickets }. Si la personne est déjà sur la roue, ses tickets s'ajoutent.
    const manual = Array.isArray(b.manual) ? b.manual : [];
    for (const raw of manual.slice(0, 500)) {
      const item = typeof raw === 'string' ? { pseudo: raw, tickets: 1 } : (raw || {});
      const name = clean(item.pseudo, 40).replace(/^@+/, '');
      let tk = Number(item.tickets);
      if (!Number.isInteger(tk) || tk < 1) tk = 1;
      tk = Math.min(tk, 100000);
      if (!name) continue;
      const existing = rows.find((r) => r.pseudo.toLowerCase() === name.toLowerCase());
      if (existing) { existing.tickets += tk; existing.extra = (existing.extra || 0) + tk; continue; }
      seen.add(name.toLowerCase());
      rows.push({ id: 0, pseudo: name, tickets: tk, ticket_code: '', manual: true });
    }
    if (b.exclude_previous_winners === true) {
      const won = new Set((await db.prepare('SELECT pseudo FROM draws WHERE confirmed = 1').all()).results.map((r) => r.pseudo.toLowerCase()));
      rows = rows.filter((r) => !won.has(r.pseudo.toLowerCase()));
    }
    return rows;
  }

  if ((mm = p.match(/^\/api\/admin\/wheel\/(\d+)$/)) && m === 'POST') {
    const day = Number(mm[1]);
    if (day < 1 || day > 24) return res.error('Case invalide', 400);
    return res.json({ entries: await wheelEntries(day, await readJson(req)) });
  }

  if ((mm = p.match(/^\/api\/admin\/draw\/(\d+)$/)) && m === 'POST') {
    const day = Number(mm[1]);
    if (day < 1 || day > 24) return res.error('Case invalide', 400);
    const b = await readJson(req);
    const entries = await wheelEntries(day, b);
    if (!entries.length) return res.error('La roue est vide : valide des participations ou ajoute des pseudos à la main.', 400);
    const total = entries.reduce((a, r) => a + r.tickets, 0);
    let pick = randomInt(total);
    const index = entries.findIndex((r) => (pick -= r.tickets) < 0);
    const w = entries[index];
    const ins = await db.prepare('INSERT INTO draws (day, participation_id, pseudo, ticket_code, manual) VALUES (?, ?, ?, ?, ?)')
      .bind(day, w.id, w.pseudo, w.ticket_code || '', w.manual ? 1 : 0).run();
    return res.json({ ok: true, entries, index, draw_id: ins.meta.last_row_id, winner: { ...w, total_tickets: total, participants: entries.length } });
  }
  if ((mm = p.match(/^\/api\/admin\/draws\/(\d+)\/confirm$/)) && m === 'POST') {
    await db.prepare('UPDATE draws SET confirmed = 1 WHERE id = ?').bind(Number(mm[1])).run();
    return res.json({ ok: true });
  }
  if (p === '/api/admin/draws' && m === 'GET') {
    const { results } = await db.prepare('SELECT d.*, c.reward FROM draws d JOIN cases c ON c.day = d.day WHERE d.confirmed = 1 ORDER BY d.id DESC').all();
    return res.json({ draws: results });
  }
  if ((mm = p.match(/^\/api\/admin\/draws\/(\d+)$/)) && m === 'DELETE') {
    await db.prepare('DELETE FROM draws WHERE id = ?').bind(Number(mm[1])).run();
    return res.json({ ok: true });
  }

  if (p === '/api/admin/account' && m === 'PUT') {
    const b = await readJson(req);
    const admin = await db.prepare('SELECT * FROM admins WHERE id = ?').bind(sess.adminId).first();
    if (!(await verifyPassword(String(b.current_code || '').trim(), admin.pass_hash))) return res.error('Code actuel incorrect.', 400);
    const next = String(b.new_code || '').trim();
    const prob = codeProblem(next);
    if (prob) return res.error(prob, 400);
    await db.batch([
      db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').bind(await hashPassword(next), admin.id),
      db.prepare('DELETE FROM sessions WHERE admin_id = ?').bind(admin.id),
    ]);
    res.setCookie(cookie('admin_session', '', { maxAge: 0 }));
    return res.json({ ok: true, relogin: true });
  }

  return res.error('Introuvable', 404);
}

// Pages d'administration (servies par le Worker, jamais en fichiers publics)
async function handleAdminPage(req, env, url, res) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const sess = await currentSession(req, env.DB);
  const file = (name) => res.build(ADMIN_FILES[name].body, 200, ADMIN_FILES[name].type);

  if (p === '/admin/login') return sess ? res.redirect('/admin') : file('login.html');
  if (p === '/admin/login.js') return file('login.js');
  if (p === '/admin/admin.css') return file('admin.css');
  if (p === '/admin') return sess ? file('admin.html') : res.redirect('/admin/login');
  if (p === '/admin/admin.js') return sess ? file('admin.js') : res.build('', 404, 'text/plain');
  return res.redirect('/admin/login');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const res = new Res();
    try {
      if (!ready) ready = init(env).catch((e) => { ready = null; throw e; });
      await ready;
      if (url.pathname.startsWith('/api/')) return await handleApi(req, env, url, res);
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return await handleAdminPage(req, env, url, res);
      return Response.redirect(new URL('/', url), 302);
    } catch (e) {
      console.error(e);
      return res.error('Erreur du serveur, réessaie dans un instant.', 500);
    }
  },
};
