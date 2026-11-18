// Tableau de bord administrateur. Toutes les données viennent d'API protégées côté serveur.
const $ = (id) => document.getElementById(id);
let CSRF = '';

const ICON_LABELS = {
  etoile: 'Étoile', boule: 'Boule de Noël', sapin: 'Sapin', cadeau: 'Cadeau', cloche: 'Cloche', 'sucre-orge': 'Sucre d’orge',
  houx: 'Houx', flocon: 'Flocon', chaussette: 'Chaussette', bougie: 'Bougie', couronne: 'Couronne', bonhomme: 'Bonhomme de neige',
};

// ---------- Utilitaires ----------
function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401) { location.href = '/admin/login'; throw new Error('Session expirée'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

let toastTimer;
function toast(msg, isErr = false) {
  const t = $('toast');
  t.textContent = msg; t.className = `toast${isErr ? ' err' : ''}`; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const nf = (n) => Number(n || 0).toLocaleString('fr-FR');

// ---------- Onglets ----------
const loaders = {};
document.querySelectorAll('.tab[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  document.querySelectorAll('.tab[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  loaders[name]?.();
}

// ---------- Tableau de bord ----------
let todayDay = null;
loaders.dashboard = async () => {
  const s = await api('/api/admin/stats');
  todayDay = s.today.day;
  const line = { avant: 'Le calendrier n’a pas encore commencé.', apres: 'Le calendrier est terminé.', pendant: `Aujourd’hui : case n°${s.today.day}.` }[s.today.status];
  $('today-line').textContent = `${line} Date utilisée : ${s.today.date}${s.today.testMode ? ' (date de test active ⚠️)' : ''}`;
  $('s-visitors-today').textContent = nf(s.totals.visitorsToday);
  $('s-visitors').textContent = nf(s.totals.visitors);
  $('s-views').textContent = nf(s.totals.views);
  $('s-participants').textContent = nf(s.totals.participants);
  $('s-participations').textContent = nf(s.totals.participations);
  $('s-tickets').textContent = nf(s.totals.tickets);
  $('s-pending').textContent = nf(s.totals.pending);
  $('s-validated').textContent = nf(s.totals.validated);

  $('by-day').replaceChildren(...s.byDay.map((r) => el('tr', { class: r.day === todayDay ? 'today' : '' },
    el('td', { text: `${r.day} déc.` }), el('td', { text: r.reward || '—' }),
    el('td', { class: 'num', text: nf(r.opens) }), el('td', { class: 'num', text: nf(r.participants) }),
    el('td', { class: 'num', text: nf(r.pending) }), el('td', { class: 'num', text: nf(r.validated) }),
    el('td', { class: 'num', text: nf(r.tickets) }), el('td', { text: r.winner ? `@${r.winner}` : '—' }))));

  $('visits').replaceChildren(...(s.visitsByDate.length ? s.visitsByDate.map((v) => el('tr', {},
    el('td', { text: new Date(v.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }) }),
    el('td', { class: 'num', text: nf(v.visitors) }), el('td', { class: 'num', text: nf(v.views) })))
    : [el('tr', {}, el('td', { colspan: 3, class: 'empty', text: 'Aucune visite pour le moment.' }))]));
};

// ---------- Participants ----------
function fillDaySelect(select, withAll) {
  select.replaceChildren(...(withAll ? [el('option', { value: '', text: 'Tous les jours' })] : []),
    ...Array.from({ length: 24 }, (_, i) => el('option', { value: i + 1, text: `${i + 1} décembre` })));
}
fillDaySelect($('p-day'), true);
fillDaySelect($('d-day'), false);

let participations = [];
loaders.participants = async () => {
  const q = new URLSearchParams();
  if ($('p-day').value) q.set('day', $('p-day').value);
  if ($('p-status').value) q.set('status', $('p-status').value);
  const data = await api(`/api/admin/participations?${q}`);
  participations = data.participations;
  renderParticipants();
};
function renderParticipants() {
  const q = $('p-search').value.trim().toLowerCase();
  const rows = participations.filter((p) => !q || p.pseudo.toLowerCase().includes(q));
  const tickets = rows.reduce((a, p) => a + p.tickets, 0);
  const cnt = (st) => rows.filter((p) => p.status === st).length;
  $('p-summary').textContent = `${nf(rows.length)} participation${rows.length > 1 ? 's' : ''} · ${nf(tickets)} ticket${tickets > 1 ? 's' : ''} · ${nf(rows.filter((p) => p.top_fan).length)} Super Fan · ⏳ ${cnt('attente')} à valider · ✅ ${cnt('validee')} validée(s) · ❌ ${cnt('refusee')} refusée(s)`;
  $('p-rows').replaceChildren(...(rows.length ? rows.map((p) => el('tr', {},
    el('td', { text: `${p.day} déc.` }),
    el('td', {}, el('a', { href: `https://www.tiktok.com/@${encodeURIComponent(p.pseudo)}`, target: '_blank', rel: 'noopener noreferrer', text: `@${p.pseudo}` })),
    el('td', { class: 'num', text: `Niv. ${p.hearts}` }),
    el('td', {}, el('span', { class: `pill ${p.top_fan ? 'oui' : 'non'}`, text: p.top_fan ? 'Oui' : 'Non' })),
    el('td', { class: 'num', text: nf(p.coins) }),
    el('td', { class: 'num', text: p.bonus ? (p.bonus > 0 ? `+${p.bonus}` : String(p.bonus)) : '—' }),
    el('td', { class: 'num', text: p.tickets }),
    el('td', { class: 'code', text: p.ticket_code }),
    el('td', {}, el('span', { class: `status ${p.status}`, text: STATUS_LABELS[p.status] || p.status })),
    el('td', { text: fmtDate(p.created_at) }),
    el('td', {}, el('div', { class: 'row-actions' },
      el('button', { class: 'btn-edit', text: '✏️ Modifier', onclick: () => openEdit(p) }),
      p.status !== 'validee' ? el('button', { class: 'btn-ok', text: 'Valider', onclick: () => setStatus(p, 'validee') }) : null,
      p.status !== 'refusee' ? el('button', { class: 'btn-no', text: 'Refuser', onclick: () => setStatus(p, 'refusee') }) : null,
      p.status !== 'attente' ? el('button', { class: 'btn-ghost', text: '↺ En attente', title: 'Remettre en attente', onclick: () => setStatus(p, 'attente') }) : null,
      el('button', { class: 'btn-danger', text: 'Supprimer', onclick: async () => {
        if (!confirm(`Supprimer la participation de @${p.pseudo} (jour ${p.day}) ?`)) return;
        try { await api(`/api/admin/participations/${p.id}`, { method: 'DELETE' }); toast('Participation supprimée'); loaders.participants(); }
        catch (e) { toast(e.message, true); }
      } })))))
    : [el('tr', {}, el('td', { colspan: 11, class: 'empty', text: 'Aucune participation pour le moment.' }))]));
}
// ----- Modifier une participation (niveau, Super Fan, pièces, tickets mérite) -----
let editing = null, rulesCache = null;
async function getRules() {
  if (!rulesCache) {
    const { settings: st } = await api('/api/admin/settings');
    const n = (k, d) => (Number.isFinite(Number(st[k])) && st[k] !== '' ? Number(st[k]) : d);
    rulesCache = { tiers: [[n('heart_t1_max', 9), n('heart_t1_mult', 1)], [n('heart_t2_max', 19), n('heart_t2_mult', 2)], [n('heart_t3_max', 50), n('heart_t3_mult', 3)]],
      superfan: n('superfan_bonus', 20), coinsPer: n('coins_per_ticket', 200) };
  }
  return rulesCache;
}
function calcTickets(r, level, fan, coins, bonus) {
  const tier = r.tiers.find(([max]) => level <= max) || r.tiers[r.tiers.length - 1];
  return Math.max(1, level * tier[1] + (fan ? r.superfan : 0) + (r.coinsPer > 0 ? Math.floor(coins / r.coinsPer) : 0) + bonus);
}
async function openEdit(p) {
  editing = p;
  const f = $('edit-form');
  f.elements.hearts.value = p.hearts; f.elements.coins.value = p.coins || 0;
  f.elements.top_fan.checked = Boolean(p.top_fan); f.elements.bonus.value = p.bonus || 0;
  $('edit-title').textContent = `Modifier @${p.pseudo} (jour ${p.day})`;
  $('edit-box').hidden = false;
  await refreshEditTotal();
}
async function refreshEditTotal() {
  const f = $('edit-form'), r = await getRules();
  const t = calcTickets(r, Number(f.elements.hearts.value) || 0, f.elements.top_fan.checked, Number(f.elements.coins.value) || 0, Number(f.elements.bonus.value) || 0);
  $('edit-total').textContent = `🎟️ Total : ${t} ticket${t > 1 ? 's' : ''}`;
}
$('edit-form').addEventListener('input', refreshEditTotal);
$('edit-cancel').addEventListener('click', () => { $('edit-box').hidden = true; });
$('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api(`/api/admin/participations/${editing.id}`, { method: 'PUT', body: {
      hearts: Number(f.elements.hearts.value) || 0, coins: Number(f.elements.coins.value) || 0,
      top_fan: f.elements.top_fan.checked, bonus: Number(f.elements.bonus.value) || 0,
    } });
    Object.assign(editing, r.participation);
    $('edit-box').hidden = true;
    renderParticipants();
    toast('Participation mise à jour');
  } catch (err) { toast(err.message, true); }
});

const STATUS_LABELS = { attente: '⏳ À valider', validee: '✅ Validée', refusee: '❌ Refusée' };
async function setStatus(p, status) {
  try {
    await api(`/api/admin/participations/${p.id}`, { method: 'PUT', body: { status } });
    p.status = status;
    renderParticipants();
  } catch (e) { toast(e.message, true); }
}
$('p-day').addEventListener('change', () => loaders.participants());
$('p-status').addEventListener('change', () => loaders.participants());
$('p-validate-all').addEventListener('click', async () => {
  const day = $('p-day').value;
  if (!day) return toast('Choisis d’abord un jour dans la liste « Jour ».', true);
  if (!confirm(`Valider toutes les participations en attente du ${day} décembre ?`)) return;
  try {
    const r = await api('/api/admin/participations/validate-all', { method: 'POST', body: { day: Number(day) } });
    toast(`${r.changed} participation(s) validée(s)`);
    loaders.participants();
  } catch (e) { toast(e.message, true); }
});
$('p-search').addEventListener('input', renderParticipants);
$('p-refresh').addEventListener('click', () => loaders.participants());

// ---------- Roue du tirage ----------
let rewards = {};
let wheelEntries = [];      // [{pseudo, tickets, manual}]
let manualNames = [];      // [{ pseudo, tickets }]
let rot = 0;                // rotation actuelle de la roue (radians)
let spinning = false;
let lastDraw = null;
const SEG_COLORS = ['#c8102e', '#0f3b2b', '#e6c068', '#1b5a41', '#8e0b20', '#f7f4ec'];
const TEXT_ON = { '#e6c068': '#2a1c05', '#f7f4ec': '#2a1c05' };

function drawOptions() {
  return {
    include_auto: $('w-auto').checked,
    validated_only: $('d-validated').checked,
    exclude_previous_winners: $('d-exclude').checked,
    manual: manualNames,
  };
}

loaders.draw = async () => {
  if (!Object.keys(rewards).length) {
    const c = await api('/api/admin/cases');
    c.cases.forEach((x) => { rewards[x.day] = x.reward; });
  }
  if (todayDay && !$('d-day').dataset.touched) $('d-day').value = todayDay;
  $('d-reward').textContent = `🎁 Lot : ${rewards[$('d-day').value] || '—'}`;
  await refreshWheel();
  await loadHistory();
};

async function refreshWheel() {
  if (spinning) return;
  try {
    const r = await api(`/api/admin/wheel/${$('d-day').value}`, { method: 'POST', body: drawOptions() });
    wheelEntries = r.entries;
  } catch (e) { toast(e.message, true); wheelEntries = []; }
  renderChips();
  const tickets = wheelEntries.reduce((a, e) => a + e.tickets, 0);
  $('w-count').textContent = wheelEntries.length
    ? `${wheelEntries.length} personne(s) sur la roue · ${tickets} ticket(s)${manualNames.length ? ` · dont ${manualNames.reduce((a, m) => a + m.tickets, 0)} ajouté(s) à la main` : ''}`
    : 'La roue est vide : valide des participations ou ajoute des pseudos à la main.';
  drawWheel();
  $('w-live').textContent = wheelEntries.length ? '—' : 'Roue vide';
}

function segments() {
  const total = wheelEntries.reduce((a, e) => a + e.tickets, 0) || 1;
  let acc = 0;
  return wheelEntries.map((e, i) => {
    const span = (e.tickets / total) * Math.PI * 2;
    const seg = { ...e, start: acc, end: acc + span, color: SEG_COLORS[i % SEG_COLORS.length] };
    acc += span;
    return seg;
  });
}

function drawWheel() {
  const cv = $('wheel');
  const ctx = cv.getContext('2d');
  const W = cv.width, R = W / 2 - 8, c = W / 2;
  ctx.clearRect(0, 0, W, W);
  // anneau doré
  ctx.beginPath(); ctx.arc(c, c, R + 6, 0, Math.PI * 2); ctx.fillStyle = '#b8862b'; ctx.fill();
  const segs = segments();
  if (!segs.length) {
    ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fillStyle = '#16261f'; ctx.fill();
    return;
  }
  const base = -Math.PI / 2 + rot;
  const many = segs.length > 60;
  for (const sg of segs) {
    ctx.beginPath(); ctx.moveTo(c, c);
    ctx.arc(c, c, R, base + sg.start, base + sg.end); ctx.closePath();
    ctx.fillStyle = sg.color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
    const span = sg.end - sg.start;
    if (!many && span > 0.06) {
      ctx.save();
      ctx.translate(c, c); ctx.rotate(base + sg.start + span / 2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = TEXT_ON[sg.color] || '#fff';
      const size = Math.max(11, Math.min(22, span * R * 0.55));
      ctx.font = `700 ${size}px system-ui, sans-serif`;
      const label = sg.pseudo.length > 16 ? sg.pseudo.slice(0, 15) + '…' : sg.pseudo;
      ctx.fillText(label, R - 16, 0);
      ctx.restore();
    }
  }
  // petites lumières sur le bord
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rot;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * (R + 1), c + Math.sin(a) * (R + 1), 3, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#fff3c4' : '#ffd36b'; ctx.fill();
  }
}

// Pseudo actuellement sous la flèche
function entryAtPointer() {
  const segs = segments();
  const a = ((-rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return segs.find((sg) => a >= sg.start && a < sg.end) || segs[segs.length - 1];
}

let audioCtx = null;
function tick() {
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 1400; o.type = 'triangle';
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.06);
  } catch { /* son indisponible */ }
}

async function spin() {
  if (spinning) return;
  const day = $('d-day').value;
  spinning = true;
  $('w-spin').disabled = true; $('w-spin-center').disabled = true;
  $('w-result').hidden = true;
  try {
    // Le gagnant est tiré au sort par le serveur ; la roue s'arrête ensuite sur lui
    const r = await api(`/api/admin/draw/${day}`, { method: 'POST', body: drawOptions() });
    wheelEntries = r.entries;
    const segs = segments();
    const target = segs[r.index];
    const inside = target.start + (target.end - target.start) * (0.15 + Math.random() * 0.7);
    const full = Math.PI * 2;
    const current = ((rot % full) + full) % full;
    let delta = ((-inside - current) % full + full) % full;
    delta += full * (6 + Math.floor(Math.random() * 3));
    const startRot = rot, duration = 7000, t0 = performance.now();
    let lastName = null;
    await new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const ease = 1 - Math.pow(1 - t, 4);
        rot = startRot + delta * ease;
        drawWheel();
        const cur = entryAtPointer();
        if (cur && cur.pseudo !== lastName) { lastName = cur.pseudo; $('w-live').textContent = `@${cur.pseudo}`; tick(); }
        if (t < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    lastDraw = { id: r.draw_id, winner: r.winner, day };
    showWinner(r.winner, day);
  } catch (e) {
    toast(e.message, true);
  } finally {
    spinning = false;
    $('w-spin').disabled = false; $('w-spin-center').disabled = false;
  }
}

function showWinner(w, day) {
  $('w-name').textContent = `@${w.pseudo}`;
  $('w-meta').textContent = `Lot du ${day} décembre : ${rewards[day] || '—'} · ${w.tickets} ticket(s) sur ${w.total_tickets} · ${w.participants} personne(s) sur la roue${w.manual ? ' · ajouté à la main' : ''}`;
  $('w-note').textContent = '';
  $('w-confirm').disabled = false;
  $('w-confirm').textContent = '✅ Confirmer ce gagnant';
  $('w-result').hidden = false;
  confettiAdmin();
}

$('w-spin').addEventListener('click', spin);
$('w-spin-center').addEventListener('click', spin);
$('w-again').addEventListener('click', () => { $('w-result').hidden = true; spin(); });
$('w-close').addEventListener('click', () => { $('w-result').hidden = true; });
$('w-copy').addEventListener('click', async () => {
  const txt = lastDraw ? lastDraw.winner.pseudo : '';
  try { await navigator.clipboard.writeText(txt); }
  catch {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.append(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  $('w-note').textContent = `Pseudo « ${txt} » copié ✓`;
});
$('w-confirm').addEventListener('click', async () => {
  if (!lastDraw) return;
  try {
    await api(`/api/admin/draws/${lastDraw.id}/confirm`, { method: 'POST', body: {} });
    $('w-confirm').disabled = true;
    $('w-confirm').textContent = 'Gagnant confirmé ✓';
    $('w-note').textContent = lastDraw.winner.manual
      ? 'Confirmé ! Comme ce pseudo a été ajouté à la main, préviens-le directement sur TikTok.'
      : 'Confirmé ! Le gagnant verra un message de victoire à sa prochaine visite sur le site.';
    loadHistory();
  } catch (e) { toast(e.message, true); }
});

function renderChips() {
  $('w-manual').replaceChildren(...manualNames.map((m) => {
    const change = (delta) => { m.tickets = Math.max(1, m.tickets + delta); refreshWheel(); };
    return el('span', { class: 'chip' }, `@${m.pseudo}`,
      el('span', { class: 'chip-tk', title: 'Tickets ajoutés' },
        el('button', { type: 'button', 'aria-label': `Un ticket de moins pour ${m.pseudo}`, text: '−', onclick: () => change(-1) }),
        `${m.tickets} 🎟️`,
        el('button', { type: 'button', 'aria-label': `Un ticket de plus pour ${m.pseudo}`, text: '+', onclick: () => change(1) })),
      el('button', { type: 'button', 'aria-label': `Retirer ${m.pseudo}`, text: '×', onclick: () => { manualNames = manualNames.filter((x) => x !== m); refreshWheel(); } }));
  }));
}
function ticketField() {
  const n = Math.floor(Number($('w-add-tickets').value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1;
}
function setTicketField(n) {
  $('w-add-tickets').value = Math.max(1, Math.min(100000, n));
  document.querySelectorAll('#w-tk-quick button').forEach((b) => b.classList.toggle('on', Number(b.dataset.tk) === Number($('w-add-tickets').value)));
}
function addManual() {
  const raw = $('w-add-input').value;
  const def = ticketField();
  const items = raw.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    // « pseudo:15 » ou « pseudo 15 » = 15 tickets pour cette personne
    const m = /^@?([^\s:]+)\s*[:\s]\s*(\d+)$/.exec(x);
    return m ? { pseudo: m[1], tickets: Math.max(1, Number(m[2])) } : { pseudo: x.replace(/^@+/, '').split(/\s+/)[0], tickets: def };
  }).filter((it) => it.pseudo);
  for (const it of items) {
    const ex = manualNames.find((x) => x.pseudo.toLowerCase() === it.pseudo.toLowerCase());
    if (ex) ex.tickets += it.tickets; else manualNames.push({ pseudo: it.pseudo.slice(0, 40), tickets: it.tickets });
  }
  if (items.length) toast(items.length === 1 ? `@${items[0].pseudo} ajouté avec ${items[0].tickets} ticket(s)` : `${items.length} pseudos ajoutés`);
  $('w-add-input').value = '';
  refreshWheel();
}
$('w-tk-minus').addEventListener('click', () => setTicketField(ticketField() - 1));
$('w-tk-plus').addEventListener('click', () => setTicketField(ticketField() + 1));
$('w-add-tickets').addEventListener('input', () => setTicketField(ticketField()));
document.querySelectorAll('#w-tk-quick button').forEach((b) => b.addEventListener('click', () => setTicketField(Number(b.dataset.tk))));
setTicketField(1);
$('w-add').addEventListener('click', addManual);
$('w-add-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } });
$('w-add-input').addEventListener('paste', () => setTimeout(() => { if (/[\n,;]/.test($('w-add-input').value)) addManual(); }, 0));
$('w-clear').addEventListener('click', () => { manualNames = []; refreshWheel(); });
['w-auto', 'd-validated', 'd-exclude'].forEach((id) => $(id).addEventListener('change', refreshWheel));
$('d-day').addEventListener('change', () => {
  $('d-day').dataset.touched = '1';
  $('d-reward').textContent = `🎁 Lot : ${rewards[$('d-day').value] || '—'}`;
  refreshWheel();
});

async function loadHistory() {
  const h = await api('/api/admin/draws');
  $('d-history').replaceChildren(...(h.draws.length ? h.draws.map((d) => el('tr', {},
    el('td', { text: `${d.day} déc.` }), el('td', { text: d.reward }), el('td', { text: `@${d.pseudo}` }),
    el('td', { class: 'code', text: d.ticket_code || '—' }),
    el('td', {}, el('span', { class: d.manual ? 'no-pill' : 'ok-pill', text: d.manual ? 'Ajout manuel (à prévenir sur TikTok)' : d.seen ? 'Vu par le gagnant ✓' : 'En attente de sa visite' })),
    el('td', { text: fmtDate(d.created_at) }),
    el('td', {}, el('button', { class: 'btn-danger', text: 'Annuler', onclick: async () => {
      if (!confirm(`Annuler la victoire de @${d.pseudo} ?`)) return;
      await api(`/api/admin/draws/${d.id}`, { method: 'DELETE' }); loadHistory();
    } }))))
    : [el('tr', {}, el('td', { colspan: 7, class: 'empty', text: 'Aucun gagnant confirmé pour le moment.' }))]));
}

function confettiAdmin() {
  const canvas = $('w-confetti');
  const ctx = canvas.getContext('2d');
  const W = canvas.width = innerWidth, H = canvas.height = innerHeight;
  const colors = ['#e6c068', '#fff3c4', '#c8102e', '#f7f4ec', '#2f8a5b', '#25f4ee', '#fe2c55'];
  const parts = Array.from({ length: 200 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H, w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
    vy: 2.5 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, r: Math.random() * 3, vr: -.1 + Math.random() * .2,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const end = performance.now() + 6000;
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y += p.vy; p.x += p.vx; p.r += p.vr;
      if (p.y > H + 20 && now < end) { p.y = -20; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (now < end + 3000 && !$('w-result').hidden) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(performance.now());
}

// ---------- Cases & lots ----------
loaders.cases = async () => {
  const { cases, icons } = await api('/api/admin/cases');
  cases.forEach((x) => { rewards[x.day] = x.reward; });
  $('case-list').replaceChildren(...cases.map((c) => caseEditor(c, icons)));
};
function caseEditor(c, icons) {
  const summaryTitle = el('b', { text: c.title || `Case ${c.day}` });
  const summaryReward = el('small', { text: c.reward ? `🎁 ${c.reward}` : 'Pas de lot' });
  const field = (label, input, full = true, hint) => el('label', { class: full ? 'full' : '' }, label, hint ? el('span', { class: 'hint', text: hint }) : null, input);
  const inp = (name, value, extra = {}) => el('input', { name, value: value || '', ...extra });

  const iconSel = el('select', { name: 'icon' }, ...icons.map((i) => el('option', { value: i, text: ICON_LABELS[i] || i, selected: i === c.icon })));
  const msg = el('textarea', { name: 'message', maxlength: 3000 }); msg.value = c.message;
  const saved = el('span', { class: 'saved', text: 'Enregistré ✓', hidden: true });

  const form = el('form', {},
    el('div', { class: 'form-grid' },
      field('Lot / récompense (gros titre)', inp('reward', c.reward, { maxlength: 300 }), false),
      field('Pastille sous le lot', inp('subtitle', c.subtitle, { maxlength: 80, placeholder: 'Une heure rien que pour toi' }), false),
      field('Couleur de la pastille', el('select', { name: 'accent' }, ...[['rouge', 'Rouge'], ['vert', 'Vert'], ['violet', 'Violet'], ['noir', 'Noir'], ['bleu', 'Bleu'], ['or', 'Doré']]
        .map(([v, t]) => el('option', { value: v, text: t, selected: v === (c.accent || 'or') }))), false),
      field('Décoration de la case', iconSel, false),
      field('Titre affiché', inp('title', c.title, { maxlength: 120 })),
      field('Message', msg),
      field('Photo du lot (optionnel)', inp('image_url', c.image_url, { placeholder: 'https://… ou /img/…' }), true, 'Photos fournies : /img/passe-de-combat.webp, /img/figurine-pop.webp, /img/peluche-tiktok.webp'),
      field('Lien (optionnel)', inp('link_url', c.link_url, { type: 'url', placeholder: 'https://www.tiktok.com/@…' }), false),
      field('Texte du bouton du lien', inp('link_label', c.link_label, { maxlength: 60, placeholder: 'Rejoindre le live' }), false)),
    el('div', { class: 'actions' }, el('button', { class: 'btn-primary', type: 'submit', text: 'Enregistrer la case' }), saved));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    try {
      const r = await api(`/api/admin/cases/${c.day}`, { method: 'PUT', body });
      summaryTitle.textContent = r.case.title || `Case ${c.day}`;
      summaryReward.textContent = r.case.reward ? `🎁 ${r.case.reward}` : 'Pas de lot';
      rewards[c.day] = r.case.reward;
      saved.hidden = false; setTimeout(() => { saved.hidden = true; }, 2000);
    } catch (err) { toast(err.message, true); }
  });

  return el('details', { class: 'case-item' },
    el('summary', {}, el('span', { class: 'd', text: c.day }), el('span', { class: 't' }, summaryTitle, summaryReward), el('span', { class: 'muted', text: 'Modifier ▾' })),
    form);
}

// ---------- Réglages ----------
loaders.settings = async () => {
  const { settings } = await api('/api/admin/settings');
  const f = $('settings-form');
  for (const [k, v] of Object.entries(settings)) {
    const input = f.elements[k];
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = v === '1'; else input.value = v;
  }
};
$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = Object.fromEntries(new FormData(f));
  body.participation_open = f.elements.participation_open.checked;
  body.music_enabled = f.elements.music_enabled.checked;
  try {
    await api('/api/admin/settings', { method: 'PUT', body });
    rulesCache = null;
    $('settings-saved').hidden = false; setTimeout(() => { $('settings-saved').hidden = true; }, 2000);
  } catch (err) { toast(err.message, true); }
});

// ---------- Compte ----------
$('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  if (body.new_code !== body.confirm) return toast('Les deux nouveaux codes ne correspondent pas.', true);
  delete body.confirm;
  try {
    await api('/api/admin/account', { method: 'PUT', body });
    alert('Code mis à jour. Reconnecte-toi avec le nouveau code.');
    location.href = '/admin/login';
  } catch (err) { toast(err.message, true); }
});

$('logout').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', body: {} }); } finally { location.href = '/admin/login'; }
});

// ---------- Démarrage ----------
(async () => {
  const me = await api('/api/admin/me');
  CSRF = me.csrf;
  $('who').textContent = 'Connecté en administrateur';
  showTab('dashboard');
})();
