# Tumulte Integration - Foundry VTT Module v2

Module d'intégration entre Foundry VTT et Tumulte pour afficher les lancés de dés, les personnages et le combat sur les overlays Twitch.

## Nouveautés v2.0

- **Connexion simplifiée** : Pairing par code (ABC-123) au lieu d'URL complexes
- **WebSocket bidirectionnel** : Communication en temps réel avec reconnexion automatique
- **Suivi du combat** : Événements de combat en temps réel sur l'overlay
- **Sync des personnages** : Synchronisation automatique des données de personnages
- **Multi-systèmes** : Support amélioré pour D&D 5e, Pathfinder 2e et autres

## Prérequis

- **Foundry VTT** version 11 ou supérieure
- **Compte Tumulte** avec une campagne configurée

## Installation

### Installation Manuelle (Développement)

1. Copiez le dossier `foundry` dans votre répertoire Foundry VTT :
   ```
   [FoundryVTT]/Data/modules/tumulte-integration/
   ```

2. Redémarrez Foundry VTT

3. Dans votre monde, allez dans **Game Settings > Manage Modules**

4. Activez le module **Tumulte Integration**

### Installation via Manifest URL (Production)

Quand le module sera publié, vous pourrez l'installer via l'URL du manifest dans Foundry.

## Configuration

### 1. Connexion avec Tumulte (Nouveau !)

1. Dans Foundry VTT, allez dans **Game Settings > Module Settings**
2. Trouvez **Tumulte Integration**
3. Cliquez sur **Connecter à Tumulte**
4. Un code de connexion s'affiche (ex: `ABC-123`)
5. Sur [tumulte.app](https://tumulte.app), allez dans **Connexions VTT**
6. Cliquez sur **Nouvelle connexion** et entrez le code
7. La connexion s'établit automatiquement !

### 2. Paramètres du Module

| Paramètre | Description |
|-----------|-------------|
| **Activer l'intégration** | Active/désactive la connexion avec Tumulte |
| **URL du serveur** | URL de votre serveur Tumulte (par défaut: localhost) |
| **Envoyer tous les lancés** | Si OFF, seuls les critiques sont envoyés |
| **Synchroniser les personnages** | Active la sync automatique des données de personnages |
| **Synchroniser le combat** | Active le suivi du combat et des tours |
| **Mode debug** | Active les logs détaillés dans la console |

## Fonctionnalités

### Lancés de Dés

Les lancés de dés sont automatiquement envoyés à Tumulte :

| Mode | Comportement |
|------|--------------|
| **Critiques uniquement** (par défaut) | Envoie les réussites (nat 20) et échecs (nat 1) critiques |
| **Tous les lancés** | Envoie tous les lancés de dés |

**Lancés secrets** : Les rolls en whisper (GM-only) sont marqués comme cachés et ne s'affichent pas sur l'overlay.

### Synchronisation des Personnages (Nouveau !)

Les personnages des joueurs sont automatiquement synchronisés :

- Nom et avatar
- Points de vie (current/max/temp)
- Statistiques principales
- Mis à jour en temps réel lors des modifications

### Suivi du Combat (Nouveau !)

Le module envoie les événements de combat en temps réel :

| Événement | Description |
|-----------|-------------|
| `combat:start` | Début du combat |
| `combat:turn` | Changement de tour (avec combattant actuel/suivant) |
| `combat:round` | Changement de round |
| `combat:end` | Fin du combat |
| `combat:combatant-add` | Ajout d'un combattant |
| `combat:combatant-remove` | Retrait d'un combattant |
| `combat:combatant-defeated` | Combattant marqué comme vaincu |

## Systèmes de Jeu Supportés

| Système | Niveau de Support |
|---------|-------------------|
| D&D 5th Edition | Complet |
| Pathfinder 2e | Complet |
| Autres systèmes | Générique (détection basique des critiques) |

## Architecture Technique

### Communication WebSocket

Le module v2 utilise une connexion WebSocket bidirectionnelle :

```
Foundry VTT <---> Socket.IO <---> Tumulte Backend <---> Overlays Twitch
```

**Caractéristiques :**
- Pairing par code (6 caractères)
- Authentification JWT avec tokens de session
- Refresh automatique des tokens
- Heartbeat ping/pong (détection de déconnexion)
- Reconnexion automatique avec backoff exponentiel

### Structure du Module

```
foundry/
├── module.json                    # Manifest v2
├── scripts/
│   ├── tumulte.js                # Point d'entrée principal
│   ├── lib/
│   │   ├── socket-client.js      # Client WebSocket
│   │   ├── pairing-manager.js    # Gestion du pairing
│   │   └── token-storage.js      # Stockage des tokens
│   ├── collectors/
│   │   ├── dice-collector.js     # Collecteur de dés
│   │   ├── character-collector.js # Collecteur de personnages
│   │   └── combat-collector.js   # Collecteur de combat
│   └── utils/
│       ├── logger.js             # Utilitaire de logging
│       └── system-adapters.js    # Adaptateurs multi-systèmes
├── vendor/
│   └── socket.io.min.js          # Socket.IO client
├── styles/
│   └── tumulte.css               # Styles v2
├── lang/
│   ├── en.json                   # Traductions anglais
│   └── fr.json                   # Traductions français
└── README.md
```

## Dépannage

### Le module ne se connecte pas

1. Vérifiez que l'URL du serveur est correcte
2. Vérifiez votre connexion Internet
3. Régénérez un nouveau code de connexion
4. Consultez la console (F12) pour les erreurs

### Les lancés de dés ne s'affichent pas

1. Vérifiez que l'intégration est activée
2. Vérifiez que la connexion est établie (indicateur vert)
3. Vérifiez le paramètre "Envoyer tous les lancés"
4. Activez le mode debug pour plus d'informations

### La connexion se déconnecte fréquemment

1. Vérifiez la stabilité de votre connexion Internet
2. Le module se reconnecte automatiquement (jusqu'à 10 tentatives)
3. Si le problème persiste, régénérez la connexion

### Erreur "Token expired"

Le module refresh automatiquement les tokens. Si cette erreur persiste :
1. Déconnectez le VTT depuis Tumulte
2. Régénérez une nouvelle connexion

## Migration depuis v1

Si vous utilisez la v1 du module (webhooks HTTP) :

1. Désactivez l'ancien module
2. Installez la v2
3. Reconnectez via le nouveau flux de pairing par code
4. Les anciennes API keys ne sont plus utilisées

## Support

- GitHub Issues : [tumulte/foundry-integration](https://github.com/tumulte/foundry-integration/issues)
- Discord Tumulte : [discord.gg/tumulte](https://discord.gg/tumulte)

## Licence

MIT License - Voir LICENSE pour plus de détails

---

## Changelog

### v2.0.0 (2025)

- **Breaking** : Nouvelle architecture WebSocket (remplace les webhooks HTTP)
- **New** : Pairing par code simplifié (ABC-123)
- **New** : Suivi du combat en temps réel
- **New** : Synchronisation automatique des personnages
- **New** : Support multi-systèmes amélioré (D&D 5e, PF2e)
- **New** : Reconnexion automatique avec backoff exponentiel
- **New** : Interface utilisateur modernisée
- **Fix** : Meilleure détection des critiques
- **Fix** : Gestion des lancés secrets améliorée

### v1.0.0 (2024)

- Version initiale avec webhooks HTTP
- Support basique des lancés de dés
- Détection des critiques D&D 5e

---

**Développé avec pour la communauté Tumulte**
