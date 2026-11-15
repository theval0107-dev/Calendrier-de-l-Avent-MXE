// Regroupe les fichiers du dossier admin/ dans worker/admin-bundle.js
// (à relancer après avoir modifié un fichier de admin/ : node tools/build-admin.mjs)
import fs from 'node:fs';
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' };
const files = {};
for (const f of fs.readdirSync('admin')) {
  files[f] = { type: types[f.split('.').pop()], body: fs.readFileSync(`admin/${f}`, 'utf8') };
}
fs.writeFileSync('worker/admin-bundle.js',
  '// Fichier généré par tools/build-admin.mjs — ne pas modifier à la main.\nexport const ADMIN_FILES = ' + JSON.stringify(files, null, 1) + ';\n');
console.log('admin-bundle.js :', Object.keys(files).join(', '));
