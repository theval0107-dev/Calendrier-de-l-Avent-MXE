// Calcule le "jour du calendrier" selon le fuseau horaire choisi (par défaut Europe/Paris).
import { getSettings } from './db.js';

function todayInTimezone(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Retourne { date: 'AAAA-MM-JJ', day: 1..24 | null, status: 'avant' | 'pendant' | 'apres' }
 * day n'est rempli que si l'on est entre le 1er et le 24 décembre de l'année configurée.
 */
export function calendarToday() {
  const s = getSettings();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s.test_date || '') ? s.test_date : todayInTimezone(s.timezone || 'Europe/Paris');
  const [y, m, d] = date.split('-').map(Number);
  const year = Number(s.year);

  let status;
  if (y < year || (y === year && (m < 12))) status = 'avant';
  else if (y === year && m === 12 && d <= 24) status = 'pendant';
  else status = 'apres';

  return { date, day: status === 'pendant' ? d : null, status, testMode: Boolean(s.test_date) };
}
