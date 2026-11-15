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

## Hébergement gratuit : Cloudflare Workers + D1
Le site tourne sur l'offre **gratuite** de Cloudflare (pas de carte bancaire). La base de données (D1) est créée automatiquement au premier déploiement.

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up
2. Va dans **Workers & Pages** → **Créer** → **Importer un dépôt** (Import a repository) → connecte GitHub → choisis ce dépôt.
3. Laisse les réglages par défaut (commande de déploiement : `npx wrangler deploy`) et lance le déploiement.
4. Une fois déployé : **Paramètres** (Settings) → **Variables et secrets** → ajoute deux **secrets** :
   - `ADMIN_EMAIL` = ton e-mail
   - `ADMIN_PASSWORD` = ton mot de passe (10 caractères minimum, lettres et chiffres)
5. Ton lien est affiché sur la page du Worker : `https://calendrier-noel.<ton-nom>.workers.dev`. L'administration est sur `/admin`.

> Le compte administrateur est créé la première fois que le site démarre avec ces deux secrets. Ensuite, change ton mot de passe depuis l'onglet **Compte**.

**Limites de l'offre gratuite** : 100 000 requêtes par jour pour le serveur (les fichiers du site, comme les images, le CSS et le JS, ne comptent pas), et une base de 5 Go. C'est largement suffisant pour un calendrier communautaire.

### Tester sur ton ordinateur (optionnel)
```bash
npm install
printf 'ADMIN_EMAIL=toi@exemple.fr\nADMIN_PASSWORD=TonMotDePasse123\n' > .dev.vars
npm run dev
```
Après avoir modifié un fichier du dossier `admin/`, lance `npm run build-admin`.

**Tester avant décembre** : Admin → Réglages → « Date de test » (ex. 2026-12-07). Pense à la vider ensuite, car les viewers voient aussi cette date.

## Sécurité
- Mots de passe chiffrés (PBKDF2-SHA256). Les sessions sont stockées en base dans des cookies `HttpOnly`, `Secure` et `SameSite=Strict`. Elles expirent après 12 h.
- Après 5 mauvaises tentatives de connexion, le compte est bloqué 15 minutes.
- Chaque action d'administration est vérifiée côté serveur, avec un jeton anti-CSRF. La page admin et son code ne sont envoyés qu'aux administrateurs connectés.
- En-têtes de sécurité : CSP, interdiction d'intégrer le site dans une autre page, nosniff.
- Toutes les saisies sont validées. Le contenu des cases n'est jamais envoyé avant le bon jour.
- Les viewers ne voient jamais les données des autres participants.

## Sauvegarde
Toutes les données sont dans la base D1 `calendrier-noel-db` (tableau de bord Cloudflare → Storage & Databases → D1). Tu peux aussi exporter les participations en CSV depuis l'admin.

## Structure
```
worker/index.js        serveur : routes, base de données, sécurité, lots par défaut
worker/admin-bundle.js pages admin regroupées (généré depuis admin/)
wrangler.jsonc         configuration Cloudflare
public/                site des viewers (calendrier, animations, musique)
admin/                 espace administrateur (sources)
```
