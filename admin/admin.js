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

  $('by-day').replaceChildren(...s.byDay.map((r) => el('tr', { class: r.day === todayDay ? 'today' : '' },
    el('td', { text: `${r.day} déc.` }), el('td', { text: r.reward || '—' }),
    el('td', { class: 'num', text: nf(r.opens) }), el('td', { class: 'num', text: nf(r.participants) }),
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
  const day = $('p-day').value;
  const data = await api(`/api/admin/participations${day ? `?day=${day}` : ''}`);
  participations = data.participations;
  renderParticipants();
};
function renderParticipants() {
  const q = $('p-search').value.trim().toLowerCase();
  const rows = participations.filter((p) => !q || p.pseudo.toLowerCase().includes(q));
  const tickets = rows.reduce((a, p) => a + p.tickets, 0);
  $('p-summary').textContent = `${nf(rows.length)} participation${rows.length > 1 ? 's' : ''} · ${nf(tickets)} ticket${tickets > 1 ? 's' : ''} · ${nf(rows.filter((p) => p.top_fan).length)} Top Fan`;
  $('p-rows').replaceChildren(...(rows.length ? rows.map((p) => el('tr', {},
    el('td', { text: `${p.day} déc.` }),
    el('td', {}, el('a', { href: `https://www.tiktok.com/@${encodeURIComponent(p.pseudo)}`, target: '_blank', rel: 'noopener noreferrer', text: `@${p.pseudo}` })),
    el('td', { class: 'num', text: nf(p.hearts) }),
    el('td', {}, el('span', { class: `pill ${p.top_fan ? 'oui' : 'non'}`, text: p.top_fan ? 'Oui' : 'Non' })),
    el('td', { class: 'num', text: p.tickets }),
    el('td', { class: 'code', text: p.ticket_code }),
    el('td', { text: fmtDate(p.created_at) }),
    el('td', {}, el('button', { class: 'btn-danger', text: 'Supprimer', onclick: async () => {
      if (!confirm(`Supprimer la participation de @${p.pseudo} (jour ${p.day}) ?`)) return;
      try { await api(`/api/admin/participations/${p.id}`, { method: 'DELETE' }); toast('Participation supprimée'); loaders.participants(); }
      catch (e) { toast(e.message, true); }
    } }))))
    : [el('tr', {}, el('td', { colspan: 8, class: 'empty', text: 'Aucune participation pour le moment.' }))]));
}
$('p-day').addEventListener('change', () => loaders.participants());
$('p-search').addEventListener('input', renderParticipants);
$('p-refresh').addEventListener('click', () => loaders.participants());

// ---------- Tirage au sort ----------
let rewards = {};
loaders.draw = async () => {
  if (!Object.keys(rewards).length) {
    const c = await api('/api/admin/cases');
    c.cases.forEach((x) => { rewards[x.day] = x.reward; });
  }
  if (todayDay && !$('d-day').dataset.touched) $('d-day').value = todayDay;
  $('d-reward').textContent = `Lot : ${rewards[$('d-day').value] || '—'}`;
  const h = await api('/api/admin/draws');
  $('d-history').replaceChildren(...(h.draws.length ? h.draws.map((d) => el('tr', {},
    el('td', { text: `${d.day} déc.` }), el('td', { text: d.reward }), el('td', { text: `@${d.pseudo}` }),
    el('td', { class: 'code', text: d.ticket_code }), el('td', { text: fmtDate(d.created_at) }),
    el('td', {}, el('button', { class: 'btn-danger', text: 'Annuler', onclick: async () => {
      if (!confirm('Annuler ce tirage ?')) return;
      await api(`/api/admin/draws/${d.id}`, { method: 'DELETE' }); loaders.draw();
    } }))))
    : [el('tr', {}, el('td', { colspan: 6, class: 'empty', text: 'Aucun tirage effectué.' }))]));
};
$('d-day').addEventListener('change', () => { $('d-day').dataset.touched = '1'; $('d-name').textContent = '—'; $('d-meta').textContent = ''; loaders.draw(); });

$('d-go').addEventListener('click', async () => {
  const day = $('d-day').value;
  const btn = $('d-go'); btn.disabled = true;
  const name = $('d-name');
  try {
    const list = (await api(`/api/admin/participations?day=${day}`)).participations;
    if (!list.length) throw new Error('Aucun participant pour ce jour.');
    // Petite animation de suspense, le vrai tirage est fait par le serveur
    name.classList.add('rolling');
    for (let i = 0; i < 22; i++) {
      name.textContent = `@${list[Math.floor(Math.random() * list.length)].pseudo}`;
      await new Promise((r) => setTimeout(r, 50 + i * 8));
    }
    const r = await api(`/api/admin/draw/${day}`, { method: 'POST', body: { exclude_previous_winners: $('d-exclude').checked } });
    name.classList.remove('rolling');
    name.textContent = `🎉 @${r.winner.pseudo}`;
    $('d-meta').textContent = `Ticket ${r.winner.ticket_code} · ${r.winner.tickets} ticket(s) sur ${r.winner.total_tickets} · ${r.winner.participants} participant(s)`;
    loaders.draw();
  } catch (e) {
    name.classList.remove('rolling'); name.textContent = '—'; toast(e.message, true);
  } finally { btn.disabled = false; }
});

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
      field('Lot / récompense', inp('reward', c.reward, { maxlength: 300 }), false),
      field('Décoration de la case', iconSel, false),
      field('Titre affiché', inp('title', c.title, { maxlength: 120 })),
      field('Message', msg),
      field('Image (lien https, optionnel)', inp('image_url', c.image_url, { type: 'url', placeholder: 'https://…' })),
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
    $('settings-saved').hidden = false; setTimeout(() => { $('settings-saved').hidden = true; }, 2000);
  } catch (err) { toast(err.message, true); }
});

// ---------- Compte ----------
$('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  if (body.new_password !== body.confirm) return toast('Les deux nouveaux mots de passe ne correspondent pas.', true);
  delete body.confirm;
  try {
    await api('/api/admin/account', { method: 'PUT', body });
    alert('Compte mis à jour. Reconnecte-toi avec tes nouveaux identifiants.');
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
  $('who').textContent = me.email;
  $('account-form').elements.email.value = me.email;
  showTab('dashboard');
})();
