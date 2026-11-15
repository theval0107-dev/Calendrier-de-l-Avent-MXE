// Base de données SQLite (intégrée à Node.js 22+, aucune installation supplémentaire)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'calendrier.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  day       INTEGER PRIMARY KEY CHECK (day BETWEEN 1 AND 24),
  title     TEXT NOT NULL DEFAULT '',
  message   TEXT NOT NULL DEFAULT '',
  reward    TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  link_url  TEXT NOT NULL DEFAULT '',
  link_label TEXT NOT NULL DEFAULT '',
  icon      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS participations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        INTEGER NOT NULL,
  pseudo     TEXT NOT NULL,
  hearts     INTEGER NOT NULL DEFAULT 0,
  top_fan    INTEGER NOT NULL DEFAULT 0,
  tickets    INTEGER NOT NULL DEFAULT 1,
  ticket_code TEXT NOT NULL UNIQUE,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_part_pseudo ON participations(day, pseudo COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_part_visitor ON participations(day, visitor_id);
CREATE TABLE IF NOT EXISTS visits (
  date       TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  views      INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, visitor_id)
);
CREATE TABLE IF NOT EXISTS draws (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        INTEGER NOT NULL,
  participation_id INTEGER NOT NULL,
  pseudo     TEXT NOT NULL,
  ticket_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS opens (
  day     INTEGER NOT NULL,
  date    TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, date)
);
`);

const ICONS = ['etoile', 'boule', 'sapin', 'cadeau', 'cloche', 'sucre-orge', 'houx', 'flocon', 'chaussette', 'bougie', 'couronne', 'bonhomme'];

// Lots par défaut (modifiables dans l'administration)
const DEFAULT_REWARDS = [
  '1H avec moi', 'Émoticônes', 'SKIN 800', 'Danse FTN', '1H avec moi', 'Émoticônes', '1H avec moi', 'Danse FTN',
  '1H avec moi', 'Émoticônes', 'VIP', 'Danse FTN', '1H avec moi', 'Émoticônes', 'Vidéo IA', '1H avec moi',
  'VIP', 'Émoticônes', 'VIP', 'Vidéo IA x1', 'SKIN 800', 'Passe de combat prochaine saison',
  'Figurine Pop One Piece', 'Peluche TikTok',
];

const DEFAULT_SETTINGS = {
  app_name: 'Calendrier de Noël',
  subtitle: 'Une surprise par jour, du 1er au 24 décembre',
  year: String(new Date().getFullYear()),
  timezone: 'Europe/Paris',
  test_date: '',            // AAAA-MM-JJ : force la date (pour tester avant décembre). Vide = vraie date.
  footer_text: 'Reviens chaque jour pour découvrir la surprise du jour 🎄',
  participation_open: '1',     // 1 = les viewers peuvent activer leur récompense
  tickets_base: '1',           // tickets donnés à chaque participation
  tickets_topfan_bonus: '0',   // tickets en plus pour un Top Fan
  tickets_hearts_step: '0',    // +1 ticket tous les X cœurs du jour (0 = désactivé)
  tickets_max: '10',           // plafond de tickets par participation
  music_enabled: '1',          // musique de Noël sur le calendrier
  music_url: '',               // lien https vers un MP3 (vide = Jingle Bells boîte à musique)
};

export function seed() {
  const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

  const insCase = db.prepare(
    'INSERT OR IGNORE INTO cases (day, title, message, reward, icon) VALUES (?, ?, ?, ?, ?)'
  );
  for (let d = 1; d <= 24; d++) {
    insCase.run(
      d,
      `Case du ${d} décembre`,
      'Bravo, tu as ouvert la case du jour ! Active ta récompense pour recevoir ton ticket de participation.',
      DEFAULT_REWARDS[d - 1],
      ICONS[(d - 1) % ICONS.length]
    );
  }
}

export const ALLOWED_ICONS = ICONS;

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}
