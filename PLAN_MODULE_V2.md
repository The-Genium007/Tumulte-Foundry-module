# Plan de Construction - Module Foundry VTT v2

**Date**: 2026-01-15
**Version cible**: 2.0.0
**Objectif**: Intégration complète Foundry ↔ Tumulte via WebSocket bidirectionnel

---

## Architecture Finale

```
┌─────────────────────────────────────────────────────────────────┐
│  Foundry VTT (Self-hosted / The Forge / Molten)                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Module Tumulte v2                                          │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │ PairingUI    │  │ WebSocket    │  │ DataCollectors   │  │ │
│  │  │ - Generate   │  │ Client       │  │ - DiceRolls      │  │ │
│  │  │   JWT URL    │  │ - Socket.IO  │  │ - Characters     │  │ │
│  │  │ - Display    │  │ - Reconnect  │  │ - Combat         │  │ │
│  │  │   QR Code    │  │ - Heartbeat  │  │ - Inventory      │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │ │
│  │                           │                                  │ │
│  └───────────────────────────┼──────────────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────┘
                               │ WebSocket (wss://)
                               │ Client initie la connexion
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend Tumulte (AdonisJS)                                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Socket.IO Server - Namespace /vtt                          │ │
│  │                                                              │ │
│  │  Events IN:                    Events OUT:                   │ │
│  │  - dice:roll                   - connected                   │ │
│  │  - campaign:sync               - ping/pong                   │ │
│  │  - character:update            - poll:start                  │ │
│  │  - combat:update               - poll:end                    │ │
│  │  - inventory:update            - connection:revoked          │ │
│  │  - pong                        - query:characters            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Services                                                    │ │
│  │  - VttWebSocketService (existant)                           │ │
│  │  - VttPairingService (existant)                             │ │
│  │  - DiceRollService (existant)                               │ │
│  │  - CharacterSyncService (à créer)                           │ │
│  │  - CombatSyncService (à créer)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Transmit WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend Nuxt (Overlay)                                        │
│                                                                  │
│  - Affichage critiques temps réel                               │
│  - Liste personnages synchronisés                               │
│  - Tracker de combat                                            │
│  - Système de votes interactifs                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 : Core Module (WebSocket + JWT Pairing)

### 1.1 Structure des fichiers

```
modules-vtt/foundry/
├── module.json                    # Manifest Foundry v12+
├── README.md                      # Documentation utilisateur
├── CHANGELOG.md                   # Historique des versions
├── scripts/
│   ├── tumulte.js                # Point d'entrée principal (ES Module)
│   ├── lib/
│   │   ├── socket-client.js      # Client WebSocket (Socket.IO)
│   │   ├── pairing-manager.js    # Gestion du pairing JWT
│   │   ├── token-storage.js      # Stockage sécurisé des tokens
│   │   └── reconnection.js       # Logique de reconnexion automatique
│   ├── collectors/
│   │   ├── dice-collector.js     # Hook createChatMessage → dice:roll
│   │   ├── character-collector.js # Sync des personnages
│   │   ├── combat-collector.js   # Événements de combat
│   │   └── inventory-collector.js # Changements d'inventaire
│   ├── ui/
│   │   ├── pairing-dialog.js     # Dialog de pairing avec QR code
│   │   ├── status-indicator.js   # Indicateur de connexion
│   │   └── settings-menu.js      # Menu de configuration
│   └── utils/
│       ├── logger.js             # Logging avec niveaux
│       ├── crypto.js             # Génération JWT côté module
│       └── system-adapters.js    # Adaptateurs par système (dnd5e, pf2e, etc.)
├── styles/
│   └── tumulte.css               # Styles pour les UI
├── lang/
│   ├── en.json                   # Traductions EN
│   └── fr.json                   # Traductions FR
├── templates/
│   ├── pairing-dialog.hbs        # Template dialog pairing
│   └── status-indicator.hbs      # Template indicateur status
└── vendor/
    └── socket.io.min.js          # Socket.IO client (bundled)
```

### 1.2 Dépendances

Le module Foundry ne peut pas utiliser npm. On doit bundler Socket.IO client :

```bash
# Télécharger Socket.IO client standalone
curl -o vendor/socket.io.min.js https://cdn.socket.io/4.7.2/socket.io.min.js
```

### 1.3 module.json (Manifest v2)

```json
{
  "id": "tumulte-integration",
  "title": "Tumulte - Twitch Integration",
  "description": "Intégration temps réel avec Tumulte pour les overlays Twitch de JDR",
  "version": "2.0.0",
  "authors": [
    {
      "name": "Tumulte Team",
      "url": "https://tumulte.app"
    }
  ],
  "compatibility": {
    "minimum": "11",
    "verified": "12",
    "maximum": "13"
  },
  "esmodules": [
    "scripts/tumulte.js"
  ],
  "styles": [
    "styles/tumulte.css"
  ],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    },
    {
      "lang": "fr",
      "name": "Français",
      "path": "lang/fr.json"
    }
  ],
  "socket": true,
  "url": "https://github.com/tumulte-app/foundry-integration",
  "bugs": "https://github.com/tumulte-app/foundry-integration/issues",
  "changelog": "https://github.com/tumulte-app/foundry-integration/blob/main/CHANGELOG.md"
}
```

---

## Phase 2 : JWT Pairing Flow

### 2.1 Flux complet

```
┌─────────────────┐                    ┌─────────────────┐
│  Foundry VTT    │                    │  Tumulte Web    │
│  (Module)       │                    │  (Frontend)     │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ 1. GM clique "Connecter à Tumulte"   │
         │                                      │
         ▼                                      │
   ┌─────────────┐                              │
   │ Génère JWT  │                              │
   │ pairing_code│                              │
   │ world_id    │                              │
   │ world_name  │                              │
   │ module_ver  │                              │
   │ nonce       │                              │
   │ exp: 5min   │                              │
   └──────┬──────┘                              │
          │                                     │
          │ 2. Affiche URL + QR Code            │
          │    foundry://connect?token=xxx&state=yyy
          │                                     │
          │                                     │
          │ 3. GM copie l'URL ou scanne QR      │
          │─────────────────────────────────────▶
          │                                     │
          │                    4. GM colle URL dans Tumulte
          │                                     │
          │                                     ▼
          │                              ┌─────────────┐
          │                              │ Parse URL   │
          │                              │ Valide JWT  │
          │                              │ Vérifie exp │
          │                              └──────┬──────┘
          │                                     │
          │         5. Crée VttConnection       │
          │            Génère session_token     │
          │            Génère refresh_token     │
          │                                     │
          │◀────────────────────────────────────│
          │      6. Retourne tokens + config    │
          │                                     │
          ▼                                     │
   ┌─────────────┐                              │
   │ Stocke      │                              │
   │ tokens      │                              │
   │ localement  │                              │
   └──────┬──────┘                              │
          │                                     │
          │ 7. Connexion WebSocket              │
          │────────────────────────────────────▶│
          │    wss://api.tumulte.app/vtt       │
          │    auth: { token: session_token }   │
          │                                     │
          │◀────────────────────────────────────│
          │      8. connected { connectionId }  │
          │                                     │
          ▼                                     ▼
   ┌─────────────┐                       ┌─────────────┐
   │ SYNC ACTIVE │                       │ Dashboard   │
   │ Dice rolls  │ ◀═════════════════▶   │ VTT active  │
   │ Characters  │    bidirectionnel     │ Overlay     │
   │ Combat      │                       │ Polls       │
   └─────────────┘                       └─────────────┘
```

### 2.2 JWT Pairing Token (généré par le module)

```javascript
// Payload du JWT généré par le module Foundry
{
  "sub": "vtt:foundry",           // Type de VTT
  "aud": "tumulte:api",           // Audience
  "iss": "foundry-module:tumulte", // Issuer
  "pairing_code": "abc123",       // Code unique de pairing
  "world_id": "my-campaign",      // ID du world Foundry
  "world_name": "Ma Campagne",    // Nom du world
  "gm_user_id": "gm-user-123",    // ID de l'utilisateur GM
  "module_version": "2.0.0",      // Version du module
  "iat": 1704067200,              // Issued at
  "exp": 1704067500,              // Expire dans 5 minutes
  "nonce": "random-nonce",        // Nonce anti-replay
  "jti": "unique-token-id"        // JWT ID unique
}
```

### 2.3 Secret partagé pour JWT

**Option A** : Secret pré-configuré (recommandé pour simplicité)
- Le module et le backend utilisent le même APP_KEY
- L'utilisateur doit configurer ce secret dans les settings du module
- Sécurisé car le secret ne transite jamais

**Option B** : Clé publique/privée
- Le module génère une paire de clés
- Plus sécurisé mais plus complexe

**Décision** : Option A avec le secret partagé (APP_KEY de Tumulte)

---

## Phase 3 : Data Collectors

### 3.1 Dice Collector

```javascript
// scripts/collectors/dice-collector.js

export class DiceCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.systemAdapter = null
  }

  initialize() {
    // Charger l'adaptateur de système
    this.systemAdapter = this.getSystemAdapter()

    // Hook principal sur les messages de chat
    Hooks.on('createChatMessage', this.onChatMessage.bind(this))

    // Hook spécifique D&D 5e pour les rolls enrichis
    if (game.system.id === 'dnd5e') {
      Hooks.on('dnd5e.rollAttack', this.onDnd5eRoll.bind(this))
      Hooks.on('dnd5e.rollDamage', this.onDnd5eRoll.bind(this))
      Hooks.on('dnd5e.rollAbilityTest', this.onDnd5eRoll.bind(this))
      Hooks.on('dnd5e.rollAbilitySave', this.onDnd5eRoll.bind(this))
      Hooks.on('dnd5e.rollSkill', this.onDnd5eRoll.bind(this))
    }
  }

  async onChatMessage(message, options, userId) {
    if (!message.isRoll) return

    const rollData = this.systemAdapter.extractRollData(message)

    this.socket.emit('dice:roll', {
      worldId: game.world.id,
      messageId: message.id,
      ...rollData,
      timestamp: Date.now()
    })
  }

  getSystemAdapter() {
    const adapters = {
      'dnd5e': new Dnd5eAdapter(),
      'pf2e': new Pf2eAdapter(),
      'default': new GenericAdapter()
    }
    return adapters[game.system.id] || adapters['default']
  }
}
```

### 3.2 Character Collector

```javascript
// scripts/collectors/character-collector.js

export class CharacterCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.syncedCharacters = new Map()
  }

  initialize() {
    // Sync initial des personnages au démarrage
    Hooks.once('ready', () => this.syncAllCharacters())

    // Hook sur les mises à jour d'acteurs
    Hooks.on('updateActor', this.onActorUpdate.bind(this))
    Hooks.on('createActor', this.onActorCreate.bind(this))
    Hooks.on('deleteActor', this.onActorDelete.bind(this))

    // Hook sur les changements d'ownership
    Hooks.on('updateUser', this.onUserUpdate.bind(this))
  }

  async syncAllCharacters() {
    const playerCharacters = game.actors.filter(a =>
      a.type === 'character' &&
      a.hasPlayerOwner
    )

    for (const actor of playerCharacters) {
      await this.syncCharacter(actor)
    }
  }

  async syncCharacter(actor) {
    const characterData = {
      vttCharacterId: actor.id,
      name: actor.name,
      avatarUrl: actor.img,
      characterType: actor.type === 'character' ? 'pc' : 'npc',
      stats: this.extractStats(actor),
      inventory: this.extractInventory(actor),
      metadata: {
        system: game.system.id,
        classes: this.extractClasses(actor),
        level: this.extractLevel(actor)
      }
    }

    this.socket.emit('character:update', {
      worldId: game.world.id,
      character: characterData,
      timestamp: Date.now()
    })

    this.syncedCharacters.set(actor.id, characterData)
  }

  extractStats(actor) {
    // Extraction générique, adaptée par système
    if (game.system.id === 'dnd5e') {
      return {
        hp: {
          current: actor.system.attributes.hp.value,
          max: actor.system.attributes.hp.max,
          temp: actor.system.attributes.hp.temp
        },
        ac: actor.system.attributes.ac.value,
        abilities: Object.fromEntries(
          Object.entries(actor.system.abilities).map(([key, val]) => [
            key,
            { value: val.value, mod: val.mod }
          ])
        )
      }
    }
    return {}
  }

  extractInventory(actor) {
    return actor.items
      .filter(i => ['weapon', 'equipment', 'consumable', 'loot'].includes(i.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: item.system.quantity || 1,
        img: item.img
      }))
  }
}
```

### 3.3 Combat Collector

```javascript
// scripts/collectors/combat-collector.js

export class CombatCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.activeCombat = null
  }

  initialize() {
    // Combat lifecycle
    Hooks.on('createCombat', this.onCombatCreate.bind(this))
    Hooks.on('updateCombat', this.onCombatUpdate.bind(this))
    Hooks.on('deleteCombat', this.onCombatDelete.bind(this))

    // Combatant changes
    Hooks.on('createCombatant', this.onCombatantAdd.bind(this))
    Hooks.on('deleteCombatant', this.onCombatantRemove.bind(this))
    Hooks.on('updateCombatant', this.onCombatantUpdate.bind(this))

    // Turn changes
    Hooks.on('combatRound', this.onRoundChange.bind(this))
    Hooks.on('combatTurn', this.onTurnChange.bind(this))
  }

  onCombatCreate(combat) {
    this.activeCombat = combat

    this.socket.emit('combat:start', {
      worldId: game.world.id,
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      combatants: this.extractCombatants(combat),
      timestamp: Date.now()
    })
  }

  onTurnChange(combat, prior, options) {
    const currentCombatant = combat.combatant

    this.socket.emit('combat:turn', {
      worldId: game.world.id,
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      currentCombatant: {
        id: currentCombatant.actor?.id,
        name: currentCombatant.name,
        initiative: currentCombatant.initiative,
        isNPC: !currentCombatant.actor?.hasPlayerOwner
      },
      timestamp: Date.now()
    })
  }

  extractCombatants(combat) {
    return combat.combatants.map(c => ({
      id: c.actor?.id,
      name: c.name,
      initiative: c.initiative,
      isDefeated: c.isDefeated,
      isNPC: !c.actor?.hasPlayerOwner,
      img: c.actor?.img
    }))
  }
}
```

---

## Phase 4 : WebSocket Client

### 4.1 Socket Client avec reconnexion

```javascript
// scripts/lib/socket-client.js

export class TumulteSocketClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'wss://api.tumulte.app'
    this.socket = null
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
    this.tokenStorage = options.tokenStorage
  }

  async connect() {
    const sessionToken = await this.tokenStorage.getSessionToken()

    if (!sessionToken) {
      throw new Error('No session token available. Please complete pairing first.')
    }

    return new Promise((resolve, reject) => {
      // Charger Socket.IO depuis vendor
      const io = window.io || globalThis.io

      this.socket = io(`${this.serverUrl}/vtt`, {
        auth: {
          token: sessionToken
        },
        transports: ['websocket'],
        reconnection: false, // On gère la reconnexion manuellement
        timeout: 10000
      })

      this.socket.on('connect', () => {
        this.connected = true
        this.reconnectAttempts = 0
        console.log('Tumulte | Connected to server')
        resolve()
      })

      this.socket.on('connected', (data) => {
        ui.notifications.info(`Tumulte: Connected to ${data.connectionId}`)
      })

      this.socket.on('disconnect', (reason) => {
        this.connected = false
        console.warn('Tumulte | Disconnected:', reason)
        this.handleDisconnect(reason)
      })

      this.socket.on('connect_error', async (error) => {
        console.error('Tumulte | Connection error:', error.message)

        // Si token expiré, tenter un refresh
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          try {
            await this.refreshToken()
            this.scheduleReconnect()
          } catch (e) {
            reject(new Error('Authentication failed. Please re-pair with Tumulte.'))
          }
        } else {
          reject(error)
        }
      })

      // Heartbeat
      this.socket.on('ping', (data) => {
        this.socket.emit('pong', { timestamp: data.timestamp })
      })

      // Connection revoked by server
      this.socket.on('connection:revoked', (data) => {
        ui.notifications.error(`Tumulte: Connection revoked - ${data.reason}`)
        this.tokenStorage.clearTokens()
        this.disconnect()
      })
    })
  }

  async refreshToken() {
    const refreshToken = await this.tokenStorage.getRefreshToken()

    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(`${this.serverUrl.replace('wss', 'https')}/vtt/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    await this.tokenStorage.storeTokens(data.sessionToken, data.refreshToken)
  }

  handleDisconnect(reason) {
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, don't reconnect
      return
    }

    this.scheduleReconnect()
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Tumulte | Max reconnect attempts reached')
      ui.notifications.error('Tumulte: Unable to reconnect. Please check your connection.')
      return
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    )

    this.reconnectAttempts++
    console.log(`Tumulte | Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect().catch(e => {
        console.error('Tumulte | Reconnect failed:', e.message)
      })
    }, delay)
  }

  emit(event, data) {
    if (!this.connected) {
      console.warn('Tumulte | Cannot emit, not connected')
      return
    }
    this.socket.emit(event, data)
  }

  on(event, callback) {
    this.socket.on(event, callback)
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.connected = false
  }
}
```

---

## Phase 5 : Pairing UI

### 5.1 Dialog de Pairing

```javascript
// scripts/ui/pairing-dialog.js

export class PairingDialog extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'tumulte-pairing',
      title: game.i18n.localize('TUMULTE.PairingDialogTitle'),
      template: 'modules/tumulte-integration/templates/pairing-dialog.hbs',
      width: 500,
      height: 'auto',
      classes: ['tumulte-pairing-dialog']
    })
  }

  constructor(pairingManager) {
    super()
    this.pairingManager = pairingManager
    this.pairingUrl = null
    this.pairingCode = null
    this.expiresAt = null
  }

  async getData() {
    // Générer le pairing JWT
    const pairingData = await this.pairingManager.generatePairingToken()

    this.pairingUrl = pairingData.url
    this.pairingCode = pairingData.code
    this.expiresAt = pairingData.expiresAt

    return {
      pairingUrl: this.pairingUrl,
      pairingCode: this.pairingCode,
      expiresIn: '5 minutes',
      tumulteUrl: this.pairingManager.getTumulteUrl(),
      qrCodeData: this.pairingUrl // Pour générer un QR code
    }
  }

  activateListeners(html) {
    super.activateListeners(html)

    // Copier l'URL
    html.find('.copy-url').click(async () => {
      await navigator.clipboard.writeText(this.pairingUrl)
      ui.notifications.info('Tumulte: Pairing URL copied to clipboard')
    })

    // Copier le code
    html.find('.copy-code').click(async () => {
      await navigator.clipboard.writeText(this.pairingCode)
      ui.notifications.info('Tumulte: Pairing code copied to clipboard')
    })

    // Ouvrir Tumulte
    html.find('.open-tumulte').click(() => {
      window.open(this.pairingManager.getTumulteUrl() + '/mj/vtt-connections/new', '_blank')
    })

    // Régénérer le code
    html.find('.regenerate').click(() => {
      this.render(true)
    })

    // Timer d'expiration
    this.startExpirationTimer(html)
  }

  startExpirationTimer(html) {
    const timerEl = html.find('.expiration-timer')

    const updateTimer = () => {
      const remaining = this.expiresAt - Date.now()

      if (remaining <= 0) {
        timerEl.text('Expired')
        html.find('.copy-url, .copy-code').prop('disabled', true)
        return
      }

      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      timerEl.text(`${minutes}:${seconds.toString().padStart(2, '0')}`)

      setTimeout(updateTimer, 1000)
    }

    updateTimer()
  }
}
```

### 5.2 Template Handlebars

```handlebars
{{!-- templates/pairing-dialog.hbs --}}
<form class="tumulte-pairing-form">
  <div class="pairing-header">
    <img src="modules/tumulte-integration/assets/tumulte-logo.png" alt="Tumulte" class="logo">
    <h2>{{localize "TUMULTE.PairingTitle"}}</h2>
  </div>

  <div class="pairing-instructions">
    <p>{{localize "TUMULTE.PairingInstructions"}}</p>
    <ol>
      <li>{{localize "TUMULTE.PairingStep1"}}</li>
      <li>{{localize "TUMULTE.PairingStep2"}}</li>
      <li>{{localize "TUMULTE.PairingStep3"}}</li>
    </ol>
  </div>

  <div class="pairing-code-section">
    <label>{{localize "TUMULTE.PairingCode"}}</label>
    <div class="code-display">
      <code class="pairing-code">{{pairingCode}}</code>
      <button type="button" class="copy-code">
        <i class="fas fa-copy"></i>
      </button>
    </div>
    <p class="expires">
      {{localize "TUMULTE.ExpiresIn"}}: <span class="expiration-timer">5:00</span>
    </p>
  </div>

  <div class="pairing-url-section">
    <label>{{localize "TUMULTE.PairingUrl"}}</label>
    <div class="url-display">
      <input type="text" readonly value="{{pairingUrl}}" class="pairing-url-input">
      <button type="button" class="copy-url">
        <i class="fas fa-copy"></i>
      </button>
    </div>
  </div>

  <div class="pairing-qr-section">
    <label>{{localize "TUMULTE.OrScanQR"}}</label>
    <div class="qr-code" data-url="{{qrCodeData}}"></div>
  </div>

  <div class="pairing-actions">
    <button type="button" class="open-tumulte">
      <i class="fas fa-external-link-alt"></i>
      {{localize "TUMULTE.OpenTumulte"}}
    </button>
    <button type="button" class="regenerate">
      <i class="fas fa-sync"></i>
      {{localize "TUMULTE.Regenerate"}}
    </button>
  </div>
</form>
```

---

## Phase 6 : Backend Modifications

### 6.1 Nouveaux endpoints nécessaires

```typescript
// Routes à ajouter dans backend/start/routes.ts

// POST /vtt/pair - Complete pairing from Tumulte frontend
router.post('/vtt/pair', [VttPairingController, 'pair'])

// POST /vtt/refresh-token - Refresh session token
router.post('/vtt/refresh-token', [VttPairingController, 'refreshToken'])

// GET /vtt/connections/:id/status - Get connection status
router.get('/vtt/connections/:id/status', [VttConnectionsController, 'status'])
```

### 6.2 Nouveaux events WebSocket

```typescript
// Events à implémenter dans vtt_websocket_service.ts

// combat:start - Début de combat
// combat:turn - Changement de tour
// combat:round - Changement de round
// combat:end - Fin de combat

// inventory:update - Changement d'inventaire
// inventory:item-used - Item consommé
```

---

## Phase 7 : Tests

### 7.1 Tests manuels

1. **Test de pairing**
   - Générer URL dans Foundry
   - Coller dans Tumulte
   - Vérifier connexion WebSocket

2. **Test de dice rolls**
   - Lancer un d20 dans Foundry
   - Vérifier réception dans Tumulte
   - Vérifier détection critique

3. **Test de reconnexion**
   - Couper le réseau
   - Vérifier reconnexion automatique
   - Vérifier refresh token

4. **Test de combat**
   - Démarrer un combat
   - Changer de tour
   - Vérifier sync en temps réel

### 7.2 Tests automatisés

```javascript
// tests/socket-client.test.js
describe('TumulteSocketClient', () => {
  it('connects with valid token')
  it('reconnects after disconnect')
  it('refreshes expired token')
  it('handles server revocation')
})

// tests/dice-collector.test.js
describe('DiceCollector', () => {
  it('detects d20 critical success')
  it('detects d20 critical failure')
  it('extracts roll formula')
  it('handles hidden rolls')
})
```

---

## Checklist de développement

### Module Foundry

- [ ] Structure de base des fichiers
- [ ] module.json v2
- [ ] Intégration Socket.IO client (vendor)
- [ ] TumulteSocketClient avec reconnexion
- [ ] TokenStorage (localStorage sécurisé)
- [ ] PairingManager (génération JWT)
- [ ] PairingDialog UI
- [ ] StatusIndicator (connexion status)
- [ ] DiceCollector
- [ ] CharacterCollector
- [ ] CombatCollector
- [ ] InventoryCollector
- [ ] System adapters (dnd5e, pf2e, generic)
- [ ] Traductions FR/EN complètes
- [ ] CSS styling
- [ ] README utilisateur
- [ ] CHANGELOG

### Backend Tumulte

- [ ] Endpoint POST /vtt/pair
- [ ] Endpoint POST /vtt/refresh-token
- [ ] Events combat dans WebSocket
- [ ] Events inventory dans WebSocket
- [ ] CharacterSyncService
- [ ] CombatSyncService
- [ ] Tests fonctionnels

### Frontend Tumulte

- [ ] Page de création connexion VTT
- [ ] Input pour coller URL de pairing
- [ ] Affichage status connexion
- [ ] Overlay dice critiques
- [ ] Overlay tracker combat
- [ ] Liste personnages sync

---

## Estimation effort

| Phase | Complexité | Fichiers |
|-------|------------|----------|
| Phase 1 (Core) | Haute | 10+ |
| Phase 2 (Pairing) | Moyenne | 5 |
| Phase 3 (Collectors) | Haute | 8 |
| Phase 4 (WebSocket) | Moyenne | 3 |
| Phase 5 (UI) | Moyenne | 5 |
| Phase 6 (Backend) | Basse | 3 |
| Phase 7 (Tests) | Moyenne | 5 |

---

**Prochaine étape** : Commencer Phase 1 - Core Module structure
