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
  adminMode = Boolean(data.admin);
  $('admin-banner').hidden = !adminMode;
  const link = $('admin-link');
  link.href = adminMode ? '/admin' : '/admin/login';
  link.querySelector('span').textContent = adminMode ? 'Ouvrir l’espace administrateur' : 'Se connecter en tant qu’administrateur';

  creatorName = data.creatorName || 'MXOU';
  const grid = $('grid');
  grid.replaceChildren();
  data.cases.forEach((c, i) => grid.append(buildCase(c, i)));
  if (data.wins && data.wins.length && !winShown) showWin(data.wins);
}
let creatorName = 'MXOU';

let adminMode = false;
function buildCase(c, index) {
  const btn = document.createElement('button');
  btn.type = 'button';
  const preview = adminMode && c.state !== 'aujourdhui';
  btn.className = `case ${c.state}${preview ? ' apercu' : ''}`;
  btn.style.animationDelay = `${index * 35}ms`;
  btn.dataset.day = c.day;

  const label = { aujourdhui: 'à ouvrir aujourd’hui', passee: 'passée', future: 'pas encore disponible' }[c.state];
  btn.setAttribute('aria-label', `Case du ${c.day} ${MOIS}, ${label}`);
  if (c.state !== 'aujourdhui' && !preview) btn.setAttribute('aria-disabled', 'true');

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
  tag.textContent = preview ? 'Aperçu admin' : { aujourdhui: 'Ouvre-moi', passee: 'Passée', future: '' }[c.state];
  door.append(num, deco, tag);
  if (c.state !== 'aujourdhui' && !preview) door.insertAdjacentHTML('beforeend', `<span class="lock">${LOCK}</span>`);

  const blockMsg = document.createElement('span');
  blockMsg.className = 'block-msg';
  btn.append(inside, door, blockMsg);

  // Admin : petit bouton au survol pour voir les participants de la case
  if (adminMode) {
    const cnt = document.createElement('span');
    cnt.className = 'count-btn';
    cnt.setAttribute('role', 'button');
    cnt.tabIndex = 0;
    cnt.title = 'Voir les participants';
    cnt.textContent = `👥 ${c.participants || 0}`;
    const openList = (e) => { e.stopPropagation(); e.preventDefault(); showParticipants(c.day); };
    cnt.addEventListener('click', openList);
    cnt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openList(e); });
    btn.append(cnt);
  }

  btn.addEventListener('click', () => openCase(btn, c));
  return btn;
}

// ---------- Ouverture d'une case ----------
let busy = false;
async function openCase(btn, c) {
  if (busy) return;
  if (c.state !== 'aujourdhui' && !adminMode) {
    // Case pas disponible : encadré rouge + grand message dans la case
    const msg = btn.querySelector('.block-msg');
    msg.textContent = c.state === 'passee' ? 'Case passée' : `⏳ Attends le ${c.day} déc.`;
    btn.classList.remove('shake', 'bloquee'); void btn.offsetWidth; btn.classList.add('shake', 'bloquee');
    clearTimeout(btn._blockTimer);
    btn._blockTimer = setTimeout(() => btn.classList.remove('bloquee'), 3200);
    toast(c.state === 'passee'
      ? 'Trop tard ! Cette case est passée : seule la case du jour peut être ouverte.'
      : `Il faut attendre jusqu’au ${c.day} ${MOIS} pour ouvrir cette case !`, true);
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
  $('m-preview').hidden = !c.preview;
  $('m-activate').textContent = c.admin ? 'Créer un ticket (admin)' : 'Activer ma récompense';
  if (c.my_participation && !c.admin) showTicket(c.my_participation);
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
  const st = p.status || 'attente';
  const el = $('t-status');
  el.className = `ticket-status ${st}`;
  el.textContent = { attente: '⏳ En attente de validation', validee: '✅ Participation validée', refusee: '❌ Participation refusée' }[st];
  $('ticket').hidden = false;
}

// ---------- Admin : liste des participants d'une case ----------
async function showParticipants(day) {
  const box = $('plist');
  $('pl-title').textContent = `Participants du ${day} ${MOIS}`;
  const body = $('pl-rows');
  body.replaceChildren();
  $('pl-summary').textContent = 'Chargement…';
  box.hidden = false;
  try {
    const res = await fetch(`/api/admin/participations?day=${day}`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const { participations } = await res.json();
    const tickets = participations.reduce((a, p) => a + p.tickets, 0);
    $('pl-summary').textContent = participations.length
      ? `${participations.length} participant(s) · ${tickets} ticket(s) · ${participations.filter((p) => p.status === 'attente').length} à valider`
      : 'Personne n’a encore participé pour cette case.';
    const label = { attente: '⏳ À valider', validee: '✅ Validée', refusee: '❌ Refusée' };
    for (const p of participations) {
      const tr = document.createElement('tr');
      const cells = [`@${p.pseudo}`, String(p.hearts), p.top_fan ? 'Oui' : 'Non', String(p.tickets), label[p.status] || p.status];
      cells.forEach((txt, i) => {
        const td = document.createElement('td');
        if (i === 0) {
          const a = document.createElement('a');
          a.href = `https://www.tiktok.com/@${encodeURIComponent(p.pseudo)}`; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.textContent = txt; td.append(a);
        } else td.textContent = txt;
        if (i === 4) td.className = `st ${p.status}`;
        tr.append(td);
      });
      body.append(tr);
    }
  } catch {
    $('pl-summary').textContent = 'Impossible de charger la liste. Reconnecte-toi à l’espace admin.';
  }
}

// ---------- Message pour le gagnant ----------
let winShown = false;
function showWin(wins) {
  winShown = true;
  const w = wins[wins.length - 1];
  $('win-pseudo').textContent = `@${w.pseudo}`;
  $('win-reward').textContent = wins.map((x) => `${x.reward} (${x.day} ${MOIS})`).join(' · ');
  $('win-text').textContent = `${creatorName} t’a normalement envoyé un message sur TikTok, ou il va bientôt le faire, pour récupérer ta récompense. Garde un œil sur tes messages !`;
  $('win').hidden = false;
  confetti();
  music?.play();
}
$('win-ok').addEventListener('click', async () => {
  $('win').hidden = true;
  try { await fetch('/api/wins/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch {}
});

function confetti() {
  if (reducedMotion) return;
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  const W = canvas.width = innerWidth, H = canvas.height = innerHeight;
  const colors = ['#e6c068', '#fff3c4', '#c8102e', '#f7f4ec', '#2f8a5b', '#25f4ee', '#fe2c55'];
  const parts = Array.from({ length: 220 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H, w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
    vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, r: Math.random() * Math.PI, vr: -.1 + Math.random() * .2,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const end = performance.now() + 9000;
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y += p.vy; p.x += p.vx + Math.sin(p.y / 40); p.r += p.vr;
      if (p.y > H + 20 && now < end) { p.y = -20; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (now < end + 4000 && !$('win').hidden) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(performance.now());
}

function closeModal() {
  $('modal').hidden = true;
  document.querySelectorAll('.case.ouverte').forEach((b) => b.classList.remove('ouverte'));
  lastFocus?.focus();
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-plist]')) { $('plist').hidden = true; return; }
  if (e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('plist').hidden) $('plist').hidden = true;
  else if (!$('modal').hidden) closeModal();
});

// ---------- Utilitaires ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let toastTimer;
function toast(msg, big = false) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  t.classList.toggle('big', big);
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
  music = createMusic({ url: data.musicUrl || null, track: data.musicTrack });
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
