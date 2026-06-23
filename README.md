# Scheduler App - Frontend Vue
Il s'agit de mon application de gestion d'emplois du temps construite avec Vue 3 et Vite, et celle ci est connectée à l'API Quarkus du backend

## Les Fonctionnalités

### Interface Générale
-  Tableau de bord avec vue d'ensemble (utilisateurs, emplois du temps, événements)
-  Vérification de l'état de l'API backend (health check)
-  Navigation par sections (Accueil, Utilisateurs, Emplois du temps)

### Gestion des Utilisateurs
-  Créer un utilisateur depuis le front
-  Afficher la liste des utilisateurs existants
-  Sélectionner l'utilisateur actif pour travailler sur ses données

### Gestion des Emplois du Temps et Événements
-  Créer un emploi du temps lié à l'utilisateur sélectionné
-  Afficher les emplois du temps de l'utilisateur
-  Ajouter des événements dans un emploi du temps
-  Visualiser les événements et leur priorité

## L'Architecture

```
Front/
├── src/
│   ├── App.vue                # Interface principale (onglets, formulaires, affichage)
│   ├── main.js                # Point d'entrée Vue
│   ├── style.css              # Design global
│   └── services/
│       └── api.js             # Client API (fetch) vers /api
├── public/
├── index.html                 # Template HTML de base
├── vite.config.js             # Config Vite + proxy vers backend
└── package.json               # Dépendances et scripts
```

## Les Technologies
Voici les différentes languages et technologies utilisé pour faire fonctionner cette app

- Vue 3
- Vite
- JavaScript
- Fetch API

##  Connexion Front ↔ Back

Le front appelle les routes via /api (ex: `/api/users`).

En développement, Vite redirige automatiquement vers le backend Quarkus grâce au proxy défini dans `vite.config.js`:

```js
server: {
	proxy: {
		'/api': {
			target: 'http://localhost:8080',
			changeOrigin: true,
		},
	},
}
```

## Les Endpoints utilisés par le front
Les Infos API pour les tests

```
GET    /api/health
GET    /api/users
POST   /api/users
GET    /api/users/{userId}/schedules
POST   /api/users/{userId}/schedules
POST   /api/schedules/{scheduleId}/items
```

## Installation & Configuration
Ce sont les près requis pour faire fonctionner l'application.

### Prérequis
- Node.js 20+
- npm 10+
- Backend Quarkus démarré sur `http://localhost:8080`

### Installation
```bash
npm install
```

### Démarrage en développement
```bash
npm run dev
```

Le front sera accessible sur `http://localhost:5173`

### Build de production
```bash
npm run build
```

### Prévisualiser le build
```bash
npm run preview
```

## Lancement complet du projet (back + front)

### 1. Démarrer le backend (dans le dossier Quarkus)
```bash
docker compose up -d
```

### 2. Vérifier l'API
```bash
curl http://localhost:8080/api/health
```

### 3. Démarrer le frontend (dans le dossier Front)
```bash
npm run dev
```

## Utilisation rapide

1. Aller dans l'onglet Utilisateurs et créer un utilisateur.
2. Aller dans Emplois du temps et créer un emploi du temps.
3. Ajouter un événement à cet emploi du temps.
4. Revenir sur Accueil pour voir les compteurs mis à jour.

## Dépannage

### Erreur CORS (403 Invalid origin)
Le backend doit autoriser l'origine `http://localhost:5173`.

### Erreur lors de la création d'utilisateur
Vérifier que:
- le `username` n'existe pas déjà,
- l'`email` n'existe pas déjà,
- tous les champs requis sont remplis.

### `npm run dev` échoue
Assurez-vous d'être dans le dossier Front/ avant d'exécuter la commande.

## Licence

MIT License

##  Support
Si vous avez des questions sur ce code, n'hésite pas à passer par mon portfolio ( https://mainportfolioantoinebasset.netlify.app )pour que je puisse répondre à votre question.
Pour toute question ou problème concernant Vue et Vite, veuillez consulter leurs documentations :
- Documentation Vue: https://vuejs.org/
- Documentation Vite: https://vite.dev/
