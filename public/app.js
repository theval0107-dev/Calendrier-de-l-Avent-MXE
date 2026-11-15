import { ICONS, LOCK } from './icons.js';
import { createMusic } from './music.js';

const $ = (id) => document.getElementById(id);
const MOIS = 'décembre';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Chargement du calendrier ----------
async function load() {
  try {
    const res = await fetch('/api/calendar', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    render(await res.json());
  } catch {
    $('status').textContent = 'Impossible de charger le calendrier. Réessaie dans un instant.';
  }
}

function render(data) {
  document.title = data.appName;
  $('app-name').textContent = data.appName;
  $('subtitle').textContent = data.subtitle;
  $('footer').textContent = data.footer;
  $('year').textContent = `Calendrier de l'Avent · ${data.year}`;

  const status = {
    avant: `Le calendrier ouvre le 1er décembre ${data.year}. Encore un peu de patience !`,
    apres: 'Le calendrier est terminé. Joyeux Noël à toutes et à tous ! 🎄',
    pendant: `Aujourd’hui, c’est le ${data.today} ${MOIS} : la case ${data.today} t’attend ✨`,
  }[data.status];
  $('status').textContent = status;

  setupMusic(data);

  const grid = $('grid');
  grid.replaceChildren();
  data.cases.forEach((c, i) => grid.append(buildCase(c, i)));
}

function buildCase(c, index) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `case ${c.state}`;
  btn.style.animationDelay = `${index * 35}ms`;
  btn.dataset.day = c.day;

  const label = { aujourdhui: 'à ouvrir aujourd’hui', passee: 'passée', future: 'pas encore disponible' }[c.state];
  btn.setAttribute('aria-label', `Case du ${c.day} ${MOIS}, ${label}`);
  if (c.state !== 'aujourdhui') btn.setAttribute('aria-disabled', 'true');

  const inside = document.createElement('div');
  inside.className = 'case-inside';

  const door = document.createElement('div');
  door.className = 'door';
  if (c.state === 'aujourdhui') {
    door.insertAdjacentHTML('beforeend', '<span class="ribbon-v"></span><span class="ribbon-h"></span>');
  }
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = c.day;
  const deco = document.createElement('span');
  deco.className = 'deco';
  deco.innerHTML = ICONS[c.icon] || ICONS.etoile; // SVG statiques, définis dans icons.js
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = { aujourdhui: 'Ouvre-moi', passee: 'Passée', future: '' }[c.state];
  door.append(num, deco, tag);
  if (c.state !== 'aujourdhui') door.insertAdjacentHTML('beforeend', `<span class="lock">${LOCK}</span>`);

  btn.append(inside, door);
  btn.addEventListener('click', () => openCase(btn, c));
  return btn;
}

// ---------- Ouverture d'une case ----------
let busy = false;
async function openCase(btn, c) {
  if (busy) return;
  if (c.state !== 'aujourdhui') {
    btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
    toast(c.state === 'passee'
      ? 'Cette case est passée : seule la case du jour peut être ouverte.'
      : `Patience ! Cette case s’ouvrira le ${c.day} ${MOIS}.`);
    return;
  }
  busy = true;
  try {
    // Le serveur vérifie de son côté que c'est bien la case du jour
    const res = await fetch(`/api/open/${c.day}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Cette case ne peut pas être ouverte.'); return; }

    btn.classList.add('ouverte');
    burst(btn);
    await wait(reducedMotion ? 50 : 750);
    showModal(data);
  } catch {
    toast('Oups, un problème de connexion. Réessaie !');
  } finally {
    busy = false;
  }
}

function burst(el) {
  if (reducedMotion) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const kinds = ['', '', 'etoile', 'etoile', 'rouge', 'blanc'];
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('span');
    s.className = `spark ${kinds[i % kinds.length]}`;
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 170;
    s.style.left = `${cx}px`; s.style.top = `${cy}px`;
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
    s.style.setProperty('--rot', `${Math.random() * 360}deg`);
    s.style.animationDelay = `${Math.random() * 120}ms`;
    document.body.append(s);
    setTimeout(() => s.remove(), 1400);
  }
}

// ---------- Fenêtre de la surprise ----------
let lastFocus = null;
function showModal(c) {
  $('m-day').textContent = `${c.day} ${MOIS}`;
  $('m-title').textContent = c.title || `Surprise du ${c.day} ${MOIS}`;
  $('m-message').textContent = c.message;

  const img = $('m-image');
  if (c.image_url) { img.src = c.image_url; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }

  $('m-reward-wrap').hidden = !c.reward;
  $('m-reward').textContent = c.reward;

  currentDay = c.day;
  $('part-form').hidden = true;
  $('f-error').hidden = true;
  $('m-closed').hidden = true;
  $('m-activate').hidden = true;
  $('ticket').hidden = true;
  if (c.my_participation) showTicket(c.my_participation);
  else if (c.participation_open) $('m-activate').hidden = false;
  else $('m-closed').hidden = false;

  const link = $('m-link');
  if (c.link_url) { link.href = c.link_url; link.textContent = c.link_label || 'En savoir plus'; link.hidden = false; }
  else link.hidden = true;

  lastFocus = document.activeElement;
  $('modal').hidden = false;
  document.querySelector('.modal-close').focus();
}

// ---------- Activer sa récompense (participation) ----------
let currentDay = null;
$('m-activate').addEventListener('click', () => {
  $('m-activate').hidden = true;
  $('part-form').hidden = false;
  $('f-pseudo').focus();
});

$('part-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('f-error');
  err.hidden = true;
  const pseudo = $('f-pseudo').value.trim().replace(/^@+/, '');
  const hearts = $('f-hearts').value.trim();
  const topFan = document.querySelector('input[name=topfan]:checked')?.value === 'oui';

  if (!/^[A-Za-z0-9._]{2,24}$/.test(pseudo)) return showError('Écris ton pseudo TikTok (lettres, chiffres, points et _ uniquement).');
  if (!/^\d{1,7}$/.test(hearts)) return showError('Indique ton nombre de cœurs du jour (un nombre, 0 si aucun).');

  const btn = $('f-submit');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/participate/${currentDay}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, hearts: Number(hearts), top_fan: topFan }),
    });
    const data = await res.json();
    if (data.my_participation) { $('part-form').hidden = true; showTicket(data.my_participation); burst($('ticket')); return; }
    showError(data.error || 'Impossible d’enregistrer ta participation.');
  } catch {
    showError('Problème de connexion, réessaie.');
  } finally {
    btn.disabled = false;
  }
});

function showError(msg) { const e = $('f-error'); e.textContent = msg; e.hidden = false; }

function showTicket(p) {
  $('t-code').textContent = p.ticket_code;
  $('t-info').textContent = `@${p.pseudo} · ${p.tickets} ticket${p.tickets > 1 ? 's' : ''}`;
  $('ticket').hidden = false;
}

function closeModal() {
  $('modal').hidden = true;
  document.querySelectorAll('.case.ouverte').forEach((b) => b.classList.remove('ouverte'));
  lastFocus?.focus();
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

// ---------- Utilitaires ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- Neige discrète ----------
function snow() {
  if (reducedMotion) return;
  const canvas = $('snow');
  const ctx = canvas.getContext('2d');
  let w, h, flakes;
  const resize = () => {
    w = canvas.width = innerWidth * devicePixelRatio;
    h = canvas.height = innerHeight * devicePixelRatio;
    const n = Math.min(120, Math.round(innerWidth / 12));
    flakes = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 1.8 + .6) * devicePixelRatio,
      s: (Math.random() * .5 + .25) * devicePixelRatio,
      d: Math.random() * Math.PI * 2, o: Math.random() * .5 + .25,
    }));
  };
  resize();
  addEventListener('resize', resize);
  (function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      f.y += f.s; f.d += .01; f.x += Math.sin(f.d) * .3 * devicePixelRatio;
      if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${f.o})`; ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
}

// ---------- Musique ----------
let music = null;
function setupMusic(data) {
  if (music || !data.musicEnabled) return;
  music = createMusic({ url: data.musicUrl || null });
  const btn = $('music-btn');
  btn.hidden = false;
  let muted = false;
  try { muted = localStorage.getItem('music-muted') === '1'; } catch {}
  const refresh = () => {
    btn.setAttribute('aria-pressed', String(music.playing));
    $('music-label').textContent = music.playing ? 'Couper la musique' : 'Musique';
    btn.classList.toggle('invite', !music.playing && !muted);
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (music.playing) { music.stop(); muted = true; } else { music.play(); muted = false; }
    try { localStorage.setItem('music-muted', muted ? '1' : '0'); } catch {}
    refresh();
  });
  // Démarre au premier geste sur la page (obligatoire pour les navigateurs)
  const first = () => {
    if (!muted && !music.playing) { music.play(); refresh(); }
    removeEventListener('pointerdown', first); removeEventListener('keydown', first);
  };
  if (!muted) { addEventListener('pointerdown', first); addEventListener('keydown', first); }
  refresh();
}

snow();
load();
// Si la page reste ouverte, on rafraîchit pour passer automatiquement au jour suivant
setInterval(load, 5 * 60 * 1000);
