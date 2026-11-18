# 🎄 Calendrier de Noël – guide

Un calendrier de l'Avent en ligne : 24 cases, une seule case ouvrable par jour, des lots, des tickets de participation et un espace administrateur privé.

## Ce que fait le site

**Côté viewers** (`/`)
- 24 cases vert foncé décorées, du 1er au 24 décembre.
- Compte à rebours doré jusqu'au 1er décembre. En décembre, compte à rebours rouge jusqu'à la prochaine case, une fois la case du jour ouverte. Les admins ne sont pas bloqués.
- Chaque viewer n'ouvre une case qu'une seule fois (c'est enregistré sur le serveur). Ensuite, il peut seulement revoir son lot et son ticket.
- Seule la case du jour s'ouvre. Les cases passées et futures restent fermées. C'est le serveur qui vérifie la date : impossible de tricher.
- À l'ouverture : animation de la porte, étincelles dorées, puis le lot du jour.
- Bouton **« Activer ma récompense »** : le viewer donne son pseudo TikTok, son nombre de cœurs du jour et s'il est Top Fan. Il reçoit un ticket (ex. `J07-K3QFZ`).
- Une seule participation par jour, par pseudo et par appareil.
- Musique de Noël (Deck the Halls, We Wish You a Merry Christmas, Jingle Bells ou Douce nuit, au choix dans les Réglages) : elle démarre au premier clic, car les navigateurs bloquent le son avant, et se coupe avec un bouton.

**Côté administrateur** (bouton en haut à gauche ou `/admin`, protégé par un code)
- Une fois connecté, tu peux **ouvrir toutes les cases en avance** sur le calendrier (aperçu).
- **Tableau de bord** : visiteurs du jour et au total, pages vues, participants, tickets, et le détail jour par jour.
- **Participants & tickets** : la liste complète (pseudo, cœurs, Top Fan, tickets, code, statut). Chaque participation arrive « à valider » : tu la **valides** ou la **refuses** après vérification sur TikTok, une par une ou toutes d'un coup pour un jour. Il y a aussi une recherche et un export Excel/CSV. Le viewer voit le statut de son ticket.
- **Roue du tirage** : la roue se remplit avec les tickets **validés** de la case, chaque ticket donnant une part de roue. Tu peux aussi ajouter des pseudos à la main. Tu fais tourner la roue, le gagnant s'affiche en grand avec un bouton pour copier son pseudo, et tu peux relancer autant de fois que tu veux. Quand tu **confirmes** un gagnant, il voit un grand message animé « Tu as gagné ! » à sa prochaine visite sur le site (sauf les pseudos ajoutés à la main).
- Sur le calendrier, en mode admin : toutes les cases s'ouvrent en avance, tu peux créer des tickets, et le bouton 👥 sur chaque case montre ses participants.
- **Cases & lots** : titre, message, lot, image, lien et décoration de chaque case.
- **Réglages** : nom du calendrier, textes, année, musique (tu peux mettre ton propre MP3), date de test, ouverture et fermeture des participations, règles des tickets.
- **Compte** : changer l'e-mail et le mot de passe.

## Règles des tickets (modifiables dans Réglages)
- ❤️ **Cœur du jour** (obligatoire) : niveau × tickets du palier. Niveau 1 à 9 = 1 ticket par niveau, 10 à 19 = 2 tickets par niveau, 20 à 50 = 3 tickets par niveau (ex. niveau 12 = 24 tickets).
- ⭐ **Super Fan** : +20 tickets.
- 🪙 **Cadeaux** : 1 ticket par tranche de 200 pièces envoyées.
- 🏆 **Mérite** : tickets ajoutés à la main par l'admin (Participants & tickets → ✏️ Modifier).

Avant de valider, le viewer doit certifier que ses informations sont exactes. Un avertissement anti-triche est affiché.

> Le niveau du Cœur du jour, le statut Super Fan et les pièces sont déclarés par le viewer. Vérifie-les sur TikTok avant de remettre un lot.

## Hébergement gratuit : Cloudflare Workers + D1
Le site tourne sur l'offre **gratuite** de Cloudflare (pas de carte bancaire). La base de données (D1) est créée automatiquement au premier déploiement.

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up
2. Va dans **Workers & Pages** → **Créer** → **Importer un dépôt** (Import a repository) → connecte GitHub → choisis ce dépôt.
3. Laisse les réglages par défaut (commande de déploiement : `npx wrangler deploy`) et lance le déploiement.
4. Une fois déployé : **Settings** → **Variables and Secrets** → ajoute un **secret** :
   - `ADMIN_CODE` = ton code administrateur (8 caractères minimum)
5. Ton lien est affiché sur la page du Worker : `https://calendrier-noel.<ton-nom>.workers.dev`. L'administration est sur `/admin`.

> Pour te connecter, utilise le bouton **« Se connecter en tant qu'administrateur »** en haut à gauche du calendrier, puis entre le code. Si tu changes le secret `ADMIN_CODE`, le code est remplacé. Tu peux aussi le changer depuis l'onglet **Compte**. Ne mets jamais le code dans les fichiers du dépôt : il est public.

**Limites de l'offre gratuite** : 100 000 requêtes par jour pour le serveur (les fichiers du site, comme les images, le CSS et le JS, ne comptent pas), et une base de 5 Go. C'est largement suffisant pour un calendrier communautaire.

### Tester sur ton ordinateur (optionnel)
```bash
npm install
printf 'ADMIN_CODE=TonCodeSecret\n' > .dev.vars
npm run dev
```
Après avoir modifié un fichier du dossier `admin/`, lance `npm run build-admin`.

**Tester avant décembre** : Admin → Réglages → « Date de test » (ex. 2026-12-07). Pense à la vider ensuite, car les viewers voient aussi cette date.

## Style et musique
- Polices libres incluses dans `public/fonts/` : Anton, Playfair Display et Poppins (licence SIL OFL).
- Photos des 3 derniers lots dans `public/img/`, tirées de la vidéo de présentation.
- Musique par défaut : « Chants de Noël », un enchaînement de chants traditionnels (Jingle Bells, We Wish You a Merry Christmas, Deck the Halls, Douce nuit) avec célesta, grelots, nappes et réverbération. Le site essaie de la lancer dès l’arrivée. Si le navigateur bloque le son, un écran d’accueil « Entrer dans le calendrier » la lance au premier clic. Le bouton en bas à gauche coupe le son. « Jingle Bells » comme dans la vidéo et d'autres choix sont disponibles dans les Réglages.

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
