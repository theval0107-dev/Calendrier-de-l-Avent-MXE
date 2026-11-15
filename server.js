import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, seed, getSettings, setSetting, ALLOWED_ICONS } from './src/db.js';
import { calendarToday } from './src/dates.js';
import {
  ensureAdmin, login, createSession, destroySession, destroyAllSessions, currentSession, requireAdmin,
  isBlocked, recordFailure, clearFailures, hashPassword, verifyPassword, passwordProblem, readCookie,
} from './src/auth.js';

seed();
ensureAdmin();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve('.');

app.disable('x-powered-by');
// Derrière un hébergeur (Render, Railway, Nginx…), l'IP réelle arrive dans X-Forwarded-For
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) app.set('trust proxy', 1);

// ---------- En-têtes de sécurité ----------
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; " +
      "connect-src 'self'; font-src 'self'; media-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '50kb' }));

// Les requêtes qui modifient des données doivent venir du site lui-même
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json')) return res.status(415).json({ error: 'Format non accepté' });
  const origin = req.get('origin');
  if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origine refusée' });
  next();
});

// ---------- Utilitaires de validation ----------
const clean = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
function cleanUrl(v) {
  const s = clean(v, 500);
  if (!s) return '';
  try {
    const u = new URL(s);
    return ['https:', 'http:'].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
}

// =====================================================================
//  API PUBLIQUE (viewers)
// =====================================================================

// Identifiant anonyme de visiteur (cookie aléatoire, aucune donnée personnelle)
function visitorId(req, res) {
  let vid = readCookie(req, 'vid');
  if (!vid || !/^[A-Za-z0-9_-]{20,40}$/.test(vid)) {
    vid = crypto.randomBytes(18).toString('base64url');
    res.cookie('vid', vid, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 365 * 86400 * 1000, path: '/' });
  }
  return vid;
}

// Limite simple par IP pour les participations (anti-spam)
const partHits = new Map();
function tooManyParticipations(ip) {
  const now = Date.now(); const hour = 3600 * 1000;
  const list = (partHits.get(ip) || []).filter((t) => now - t < hour);
  list.push(now); partHits.set(ip, list);
  return list.length > 20;
}
setInterval(() => partHits.clear(), 6 * 3600 * 1000).unref();

function computeTickets(s, hearts, topFan) {
  const base = Number(s.tickets_base) || 1;
  const bonus = topFan ? Number(s.tickets_topfan_bonus) || 0 : 0;
  const step = Number(s.tickets_hearts_step) || 0;
  const fromHearts = step > 0 ? Math.floor(hearts / step) : 0;
  const max = Math.max(1, Number(s.tickets_max) || 10);
  return Math.min(max, Math.max(1, base + bonus + fromHearts));
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function ticketCode(day) {
  const bytes = crypto.randomBytes(5);
  let r = '';
  for (const b of bytes) r += CODE_CHARS[b % CODE_CHARS.length];
  return `J${String(day).padStart(2, '0')}-${r}`;
}

app.get('/api/calendar', (req, res) => {
  const s = getSettings();
  const t = calendarToday();
  const vid = visitorId(req, res);
  db.prepare('INSERT INTO visits (date, visitor_id) VALUES (?, ?) ON CONFLICT(date, visitor_id) DO UPDATE SET views = views + 1').run(t.date, vid);
  const icons = db.prepare('SELECT day, icon FROM cases ORDER BY day').all();
  res.set('Cache-Control', 'no-store');
  res.json({
    appName: s.app_name,
    subtitle: s.subtitle,
    footer: s.footer_text,
    musicEnabled: s.music_enabled === '1',
    musicUrl: s.music_url || '',
    year: Number(s.year),
    status: t.status,
    today: t.day,
    // Aucun contenu de case n'est envoyé ici : seulement l'état et la décoration.
    cases: icons.map((c) => ({
      day: c.day,
      icon: c.icon,
      state: t.day === null ? (t.status === 'apres' ? 'passee' : 'future')
        : c.day === t.day ? 'aujourdhui' : c.day < t.day ? 'passee' : 'future',
    })),
  });
});

// Ouvrir une case : le serveur vérifie que c'est bien la case du jour.
app.post('/api/open/:day', (req, res) => {
  const day = Number(req.params.day);
  const t = calendarToday();
  if (!Number.isInteger(day) || day < 1 || day > 24) return res.status(400).json({ error: 'Case invalide' });
  if (t.day !== day) {
    const msg = t.day === null
      ? (t.status === 'avant' ? 'Le calendrier commence le 1er décembre !' : 'Le calendrier est terminé. Joyeux Noël !')
      : day < t.day ? 'Cette case est passée : seule la case du jour peut être ouverte.' : 'Patience ! Cette case n’est pas encore disponible.';
    return res.status(403).json({ error: msg });
  }
  const s = getSettings();
  const c = db.prepare('SELECT day, title, message, reward, image_url, link_url, link_label FROM cases WHERE day = ?').get(day);
  db.prepare('INSERT INTO opens (day, date, count) VALUES (?, ?, 1) ON CONFLICT(day, date) DO UPDATE SET count = count + 1').run(day, t.date);
  const vid = visitorId(req, res);
  const mine = db.prepare('SELECT pseudo, tickets, ticket_code FROM participations WHERE day = ? AND visitor_id = ?').get(day, vid);
  res.set('Cache-Control', 'no-store');
  res.json({ ...c, participation_open: s.participation_open === '1', my_participation: mine || null });
});

// Activer sa récompense = participer au tirage du jour et recevoir un ticket
app.post('/api/participate/:day', (req, res) => {
  const day = Number(req.params.day);
  const t = calendarToday();
  const s = getSettings();
  if (t.day !== day) return res.status(403).json({ error: 'Tu ne peux participer qu’à la case du jour.' });
  if (s.participation_open !== '1') return res.status(403).json({ error: 'Les participations sont fermées pour le moment.' });
  if (tooManyParticipations(req.ip)) return res.status(429).json({ error: 'Trop de tentatives, réessaie plus tard.' });

  const b = req.body || {};
  const pseudo = clean(b.pseudo, 40).replace(/^@+/, '');
  if (!/^[A-Za-z0-9._]{2,24}$/.test(pseudo)) {
    return res.status(400).json({ error: 'Pseudo TikTok invalide (lettres, chiffres, points et _ uniquement, 2 à 24 caractères).' });
  }
  const hearts = Number(b.hearts);
  if (!Number.isInteger(hearts) || hearts < 0 || hearts > 1000000) return res.status(400).json({ error: 'Nombre de cœurs invalide.' });
  const topFan = b.top_fan === true;

  const vid = visitorId(req, res);
  const already = db.prepare('SELECT pseudo, tickets, ticket_code FROM participations WHERE day = ? AND visitor_id = ?').get(day, vid);
  if (already) return res.status(409).json({ error: 'Tu as déjà activé ta récompense aujourd’hui.', my_participation: already });
  if (db.prepare('SELECT 1 FROM participations WHERE day = ? AND pseudo = ? COLLATE NOCASE').get(day, pseudo)) {
    return res.status(409).json({ error: 'Ce pseudo a déjà participé aujourd’hui.' });
  }

  const tickets = computeTickets(s, hearts, topFan);
  let code;
  for (let i = 0; i < 5; i++) {
    code = ticketCode(day);
    try {
      db.prepare('INSERT INTO participations (day, pseudo, hearts, top_fan, tickets, ticket_code, visitor_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(day, pseudo, hearts, topFan ? 1 : 0, tickets, code, vid);
      return res.json({ ok: true, my_participation: { pseudo, tickets, ticket_code: code } });
    } catch (e) {
      if (!String(e.message).includes('ticket_code')) {
        return res.status(409).json({ error: 'Participation déjà enregistrée pour aujourd’hui.' });
      }
    }
  }
  res.status(500).json({ error: 'Erreur, réessaie.' });
});

// =====================================================================
//  API ADMINISTRATEUR (toutes les routes vérifient la session côté serveur)
// =====================================================================
app.post('/api/admin/login', (req, res) => {
  const email = clean(req.body?.email, 200);
  const password = String(req.body?.password ?? '').slice(0, 200);
  const ip = req.ip;
  const wait = isBlocked(ip, email);
  if (wait) return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${wait} min.` });
  const admin = login(email, password);
  if (!admin) {
    recordFailure(ip, email);
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  clearFailures(ip, email);
  const csrf = createSession(res, admin.id);
  res.json({ ok: true, csrf });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ email: req.admin.email, csrf: req.admin.csrf });
});

app.get('/api/admin/cases', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ cases: db.prepare('SELECT * FROM cases ORDER BY day').all(), icons: ALLOWED_ICONS });
});

app.put('/api/admin/cases/:day', requireAdmin, (req, res) => {
  const day = Number(req.params.day);
  if (!Number.isInteger(day) || day < 1 || day > 24) return res.status(400).json({ error: 'Case invalide' });
  const b = req.body || {};
  const image_url = cleanUrl(b.image_url);
  const link_url = cleanUrl(b.link_url);
  if (image_url === null) return res.status(400).json({ error: 'Lien d’image invalide (doit commencer par https://)' });
  if (link_url === null) return res.status(400).json({ error: 'Lien invalide (doit commencer par https://)' });
  const icon = ALLOWED_ICONS.includes(b.icon) ? b.icon : ALLOWED_ICONS[0];
  db.prepare(`UPDATE cases SET title = ?, message = ?, reward = ?, image_url = ?, link_url = ?, link_label = ?, icon = ?,
              updated_at = datetime('now') WHERE day = ?`)
    .run(clean(b.title, 120), clean(b.message, 3000), clean(b.reward, 300), image_url, link_url, clean(b.link_label, 60), icon, day);
  res.json({ ok: true, case: db.prepare('SELECT * FROM cases WHERE day = ?').get(day) });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ settings: getSettings(), today: calendarToday() });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return res.status(400).json({ error: 'Année invalide' });
  const test = clean(b.test_date, 10);
  if (test && !/^\d{4}-\d{2}-\d{2}$/.test(test)) return res.status(400).json({ error: 'Date de test invalide' });
  const tz = clean(b.timezone, 60) || 'Europe/Paris';
  try { new Intl.DateTimeFormat('fr', { timeZone: tz }); } catch { return res.status(400).json({ error: 'Fuseau horaire invalide' }); }
  const name = clean(b.app_name, 80);
  if (!name) return res.status(400).json({ error: 'Le nom du calendrier est obligatoire' });
  setSetting('app_name', name);
  setSetting('subtitle', clean(b.subtitle, 200));
  setSetting('footer_text', clean(b.footer_text, 300));
  setSetting('year', String(year));
  setSetting('timezone', tz);
  setSetting('test_date', test);
  setSetting('participation_open', b.participation_open ? '1' : '0');
  setSetting('music_enabled', b.music_enabled ? '1' : '0');
  const musicUrl = cleanUrl(b.music_url);
  if (musicUrl === null || (musicUrl && !musicUrl.startsWith('https://'))) return res.status(400).json({ error: 'Le lien de la musique doit commencer par https://' });
  setSetting('music_url', musicUrl);
  const int = (v, min, max, def) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? String(n) : String(def); };
  setSetting('tickets_base', int(b.tickets_base, 1, 100, 1));
  setSetting('tickets_topfan_bonus', int(b.tickets_topfan_bonus, 0, 100, 0));
  setSetting('tickets_hearts_step', int(b.tickets_hearts_step, 0, 1000000, 0));
  setSetting('tickets_max', int(b.tickets_max, 1, 1000, 10));
  res.json({ ok: true, settings: getSettings(), today: calendarToday() });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const t = calendarToday();
  res.json({
    today: t,
    totals: {
      visitors: db.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits').get().n,
      views: db.prepare('SELECT COALESCE(SUM(views),0) AS n FROM visits').get().n,
      visitorsToday: db.prepare('SELECT COUNT(*) AS n FROM visits WHERE date = ?').get(t.date).n,
      participants: db.prepare('SELECT COUNT(DISTINCT pseudo COLLATE NOCASE) AS n FROM participations').get().n,
      participations: db.prepare('SELECT COUNT(*) AS n FROM participations').get().n,
      tickets: db.prepare('SELECT COALESCE(SUM(tickets),0) AS n FROM participations').get().n,
    },
    visitsByDate: db.prepare('SELECT date, COUNT(*) AS visitors, SUM(views) AS views FROM visits GROUP BY date ORDER BY date DESC LIMIT 60').all(),
    byDay: db.prepare(`SELECT c.day, c.reward,
        (SELECT COUNT(*) FROM participations p WHERE p.day = c.day) AS participants,
        (SELECT COALESCE(SUM(tickets),0) FROM participations p WHERE p.day = c.day) AS tickets,
        (SELECT COALESCE(SUM(count),0) FROM opens o WHERE o.day = c.day) AS opens,
        (SELECT pseudo FROM draws d WHERE d.day = c.day ORDER BY id DESC LIMIT 1) AS winner
      FROM cases c ORDER BY c.day`).all(),
  });
});

app.get('/api/admin/participations', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const day = Number(req.query.day);
  const rows = Number.isInteger(day) && day >= 1 && day <= 24
    ? db.prepare('SELECT id, day, pseudo, hearts, top_fan, tickets, ticket_code, created_at FROM participations WHERE day = ? ORDER BY id DESC').all(day)
    : db.prepare('SELECT id, day, pseudo, hearts, top_fan, tickets, ticket_code, created_at FROM participations ORDER BY id DESC LIMIT 5000').all();
  res.json({ participations: rows });
});

app.get('/api/admin/participations.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT day, pseudo, hearts, top_fan, tickets, ticket_code, created_at FROM participations ORDER BY day, id').all();
  const esc = (v) => { let x = String(v ?? ''); if (/^[=+\-@]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; };
  const lines = ['Jour;Pseudo TikTok;Coeurs du jour;Top Fan;Tickets;Code ticket;Date (UTC)']
    .concat(rows.map((r) => [r.day, r.pseudo, r.hearts, r.top_fan ? 'Oui' : 'Non', r.tickets, r.ticket_code, r.created_at].map(esc).join(';')));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="participations.csv"', 'Cache-Control': 'no-store' });
  res.send('\ufeff' + lines.join('\r\n'));
});

app.delete('/api/admin/participations/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM participations WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Tirage au sort pondéré par le nombre de tickets
app.post('/api/admin/draw/:day', requireAdmin, (req, res) => {
  const day = Number(req.params.day);
  if (!Number.isInteger(day) || day < 1 || day > 24) return res.status(400).json({ error: 'Case invalide' });
  const exclude = req.body?.exclude_previous_winners === true;
  let rows = db.prepare('SELECT id, pseudo, tickets, ticket_code FROM participations WHERE day = ?').all(day);
  if (exclude) {
    const won = new Set(db.prepare('SELECT pseudo FROM draws').all().map((r) => r.pseudo.toLowerCase()));
    rows = rows.filter((r) => !won.has(r.pseudo.toLowerCase()));
  }
  if (!rows.length) return res.status(400).json({ error: 'Aucun participant éligible pour ce jour.' });
  const total = rows.reduce((a, r) => a + r.tickets, 0);
  let pick = crypto.randomInt(total);
  const winner = rows.find((r) => (pick -= r.tickets) < 0);
  db.prepare('INSERT INTO draws (day, participation_id, pseudo, ticket_code) VALUES (?, ?, ?, ?)').run(day, winner.id, winner.pseudo, winner.ticket_code);
  res.json({ ok: true, winner: { ...winner, total_tickets: total, participants: rows.length } });
});

app.get('/api/admin/draws', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ draws: db.prepare('SELECT d.*, c.reward FROM draws d JOIN cases c ON c.day = d.day ORDER BY d.id DESC').all() });
});

app.delete('/api/admin/draws/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM draws WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.put('/api/admin/account', requireAdmin, (req, res) => {
  const b = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.adminId);
  if (!verifyPassword(String(b.current_password || ''), admin.pass_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }
  const email = clean(b.email, 200) || admin.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  let hash = admin.pass_hash;
  if (b.new_password) {
    const p = passwordProblem(b.new_password);
    if (p) return res.status(400).json({ error: p });
    hash = hashPassword(b.new_password);
  }
  db.prepare('UPDATE admins SET email = ?, pass_hash = ? WHERE id = ?').run(email, hash, admin.id);
  // Par sécurité, toutes les sessions sont fermées : il faut se reconnecter.
  destroyAllSessions(admin.id);
  destroySession(req, res);
  res.json({ ok: true, relogin: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Introuvable' }));

// =====================================================================
//  PAGES
// =====================================================================
const send = (file) => (req, res) => res.sendFile(path.join(ROOT, file));

// Administration : la page du tableau de bord n'est servie qu'aux administrateurs connectés.
app.get('/admin/login', (req, res) => {
  if (currentSession(req)) return res.redirect('/admin');
  res.sendFile(path.join(ROOT, 'admin/login.html'));
});
app.get('/admin/login.js', send('admin/login.js'));
app.get('/admin/admin.css', send('admin/admin.css'));
app.get(['/admin', '/admin/'], (req, res) => {
  if (!currentSession(req)) return res.redirect('/admin/login');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'admin/admin.html'));
});
app.get('/admin/admin.js', (req, res) => {
  if (!currentSession(req)) return res.status(404).end();
  res.sendFile(path.join(ROOT, 'admin/admin.js'));
});
app.use('/admin', (req, res) => res.redirect('/admin/login'));

app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html' }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'public/index.html')));

app.listen(PORT, () => console.log(`🎄 Calendrier en ligne sur http://localhost:${PORT}  (admin : /admin)`));
