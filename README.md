# 🎄 Calendrier de Noël – guide

Un calendrier de l'Avent en ligne : 24 cases, une seule case ouvrable par jour, des lots, des tickets de participation et un espace administrateur privé.

## Ce que fait le site

**Côté viewers** (`/`)
- 24 cases vert foncé décorées, du 1er au 24 décembre.
- Seule la case du jour s'ouvre. Les cases passées et futures restent fermées. C'est le serveur qui vérifie la date : impossible de tricher.
- À l'ouverture : animation de la porte, étincelles dorées, puis le lot du jour.
- Bouton **« Activer ma récompense »** : le viewer donne son pseudo TikTok, son nombre de cœurs du jour et s'il est Top Fan. Il reçoit un ticket (ex. `J07-K3QFZ`).
- Une seule participation par jour, par pseudo et par appareil.
- Musique de Noël : elle démarre au premier clic (les navigateurs bloquent le son avant) et se coupe avec un bouton.

**Côté administrateur** (`/admin`, protégé par mot de passe)
- **Tableau de bord** : visiteurs du jour et au total, pages vues, participants, tickets, et le détail jour par jour.
- **Participants & tickets** : la liste complète (pseudo, cœurs, Top Fan, tickets, code), recherche, suppression, export Excel/CSV.
- **Tirage au sort** : un gagnant par jour, avec une chance par ticket. Historique des tirages et possibilité d'annuler.
- **Cases & lots** : titre, message, lot, image, lien et décoration de chaque case.
- **Réglages** : nom du calendrier, textes, année, musique (tu peux mettre ton propre MP3), date de test, ouverture et fermeture des participations, règles des tickets.
- **Compte** : changer l'e-mail et le mot de passe.

## Règles des tickets (dans Réglages)
- Tickets par participation (par défaut : 1)
- Tickets bonus si Top Fan (par défaut : 0)
- +1 ticket tous les X cœurs du jour (par défaut : désactivé)
- Maximum de tickets par personne (par défaut : 10)

> Le nombre de cœurs et le statut Top Fan sont déclarés par le viewer. Vérifie-les sur TikTok avant de remettre un lot.

## Lancer le site sur ton ordinateur
Il faut **Node.js 22.13 ou plus récent** (https://nodejs.org).

```bash
npm install
ADMIN_EMAIL=toi@exemple.fr ADMIN_PASSWORD=TonMotDePasse123 npm start
```
Ouvre ensuite http://localhost:3000 pour le calendrier et http://localhost:3000/admin pour l'administration.

Si tu ne donnes pas `ADMIN_PASSWORD`, un mot de passe est créé automatiquement et affiché dans le terminal au premier lancement.

**Tester avant décembre** : Admin → Réglages → « Date de test » (ex. 2026-12-07). Pense à la vider ensuite, car les viewers voient aussi cette date.

## Mettre le site en ligne (exemple avec Railway ou Render)
1. Mets ce dossier sur GitHub (sans `node_modules` ni `data`).
2. Crée un nouveau service à partir du dépôt.
   - Commande de démarrage : `npm start`
3. Ajoute les variables d'environnement :
   - `NODE_ENV=production`
   - `ADMIN_EMAIL=ton e-mail`
   - `ADMIN_PASSWORD=un mot de passe solide (10 caractères minimum, avec lettres et chiffres)`
   - `DATA_DIR=/data`
4. **Important** : ajoute un **disque ou volume persistant** monté sur `/data`. Sans lui, les participations seraient effacées à chaque redémarrage.
5. Ouvre l'adresse fournie par l'hébergeur. Connecte-toi sur `/admin` et change ton mot de passe dans l'onglet Compte.

Le site doit être servi en **HTTPS** (c'est automatique sur Railway et Render).

## Sécurité
- Mots de passe chiffrés (scrypt). Les sessions sont stockées en base dans des cookies `httpOnly`, `SameSite=Strict` et `Secure` en production. Elles expirent après 12 h.
- Après 5 mauvaises tentatives de connexion, le compte est bloqué 15 minutes.
- Chaque action d'administration est vérifiée côté serveur, avec un jeton anti-CSRF. La page admin et son code ne sont envoyés qu'aux administrateurs connectés.
- En-têtes de sécurité : CSP, interdiction d'intégrer le site dans une autre page, nosniff.
- Toutes les saisies sont validées. Le contenu des cases n'est jamais envoyé avant le bon jour.
- Les viewers ne voient jamais les données des autres participants.

## Sauvegarde
Toutes les données sont dans `data/calendrier.db`. Copie ce fichier pour faire une sauvegarde.

## Structure
```
server.js          serveur et routes (public + admin)
src/db.js          base de données et valeurs par défaut (lots)
src/auth.js        connexion, sessions, sécurité
src/dates.js       calcul du jour du calendrier (fuseau Europe/Paris)
public/            site des viewers (calendrier, animations, musique)
admin/             espace administrateur
```
