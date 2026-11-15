const form = document.getElementById('login-form');
const err = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;
  const btn = document.getElementById('submit');
  btn.disabled = true;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value }),
    });
    const data = await res.json();
    if (res.ok) { location.href = '/admin'; return; }
    err.textContent = data.error || 'Connexion impossible.';
    err.hidden = false;
  } catch {
    err.textContent = 'Problème de connexion au serveur.';
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
});
