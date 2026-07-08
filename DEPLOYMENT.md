# Mise en ligne Front + Back

Ce projet peut etre deploye avec :

- Front Vue/Vite : Netlify ou Vercel
- Back Quarkus : Render ou Railway
- Base de donnees : PostgreSQL managé chez Render/Railway

L'ordre conseille est : base de donnees, backend, puis frontend.

## 1. Backend Quarkus

### Option simple : Render

1. Creer une base PostgreSQL sur Render.
2. Creer un `Web Service` depuis le repo du backend Quarkus.
3. Choisir `Docker` comme environnement de build.
4. Ajouter ces variables d'environnement :

```env
DB_USERNAME=<user_postgres_render>
DB_PASSWORD=<password_postgres_render>
DB_JDBC_URL=jdbc:postgresql://<host>:<port>/<database>
DB_GENERATION=update
JWT_SECRET=<secret_long_aleatoire_minimum_32_caracteres>
CORS_ORIGINS=https://<url-du-front>
GOOGLE_CLIENT_ID=<client-id-google-si-utilise>
```

Important : `DB_JDBC_URL` doit etre une URL JDBC, donc elle commence par `jdbc:postgresql://`.

Exemple :

```env
DB_JDBC_URL=jdbc:postgresql://dpg-xxxxx.frankfurt-postgres.render.com:5432/scheduler_db
```

Une fois deploye, tester :

```bash
curl https://<url-du-back>/api/health
```

## 2. Front Vue/Vite

### Option simple : Netlify

1. Creer un site depuis le repo du front.
2. Build command :

```bash
npm run build
```

3. Publish directory :

```text
dist
```

4. Ajouter cette variable d'environnement :

```env
VITE_API_URL=https://<url-du-back>/api
```

5. Redeployer le site.

### Option Vercel

Les valeurs sont presque les memes :

- Framework Preset : `Vite`
- Build Command : `npm run build`
- Output Directory : `dist`
- Environment Variable : `VITE_API_URL=https://<url-du-back>/api`

## 3. CORS

Quand le front est en ligne, copier son URL publique dans la variable backend :

```env
CORS_ORIGINS=https://<url-du-front>
```

Si plusieurs URLs doivent etre autorisees, les separer par des virgules :

```env
CORS_ORIGINS=http://localhost:5173,https://<url-du-front>
```

## 4. Verification finale

1. Ouvrir le front en ligne.
2. Verifier que le statut API est OK.
3. Creer un compte ou se connecter.
4. Creer un emploi du temps.
5. Ajouter un evenement.

## Variables utiles

### Front

```env
VITE_API_URL=https://<url-du-back>/api
VITE_ADMIN_USERNAMES=admin,antoine
VITE_GOOGLE_CLIENT_ID=<client-id-google-si-utilise>
```

### Back

```env
DB_USERNAME=<user_postgres>
DB_PASSWORD=<password_postgres>
DB_JDBC_URL=jdbc:postgresql://<host>:<port>/<database>
DB_GENERATION=update
JWT_SECRET=<secret_long_aleatoire_minimum_32_caracteres>
CORS_ORIGINS=https://<url-du-front>
GOOGLE_CLIENT_ID=<client-id-google-si-utilise>
```

## Notes importantes

- Ne pas utiliser `drop-and-create` en production, sinon les donnees sont supprimees au redemarrage.
- Ne pas commiter les vrais mots de passe ou secrets.
- Si Google Login est active, ajouter l'URL du front dans les origines autorisees du client OAuth Google Cloud.
