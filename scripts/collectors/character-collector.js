/**
 * Character Collector
 * Synchronizes character data from Foundry VTT to Tumulte
 */

import Logger from '../utils/logger.js'
import { getSystemAdapter } from '../utils/system-adapters.js'

export class CharacterCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.systemAdapter = null
    this.syncedCharacters = new Map()
    this.syncDebounce = new Map()
    this.debounceDelay = 2000 // 2 seconds debounce
  }

  /**
   * Initialize the collector
   */
  initialize() {
    this.systemAdapter = getSystemAdapter()

    // Actor update hooks
    Hooks.on('updateActor', this.onActorUpdate.bind(this))
    Hooks.on('createActor', this.onActorCreate.bind(this))
    Hooks.on('deleteActor', this.onActorDelete.bind(this))

    // Item changes (for inventory sync)
    Hooks.on('createItem', this.onItemChange.bind(this))
    Hooks.on('updateItem', this.onItemChange.bind(this))
    Hooks.on('deleteItem', this.onItemChange.bind(this))

    Logger.info('Character Collector initialized')

    // Initial sync - game is already ready when this is called
    // (we're initialized after successful WebSocket connection)
    setTimeout(() => this.syncAllCharacters(), 2000)
  }

  /**
   * Sync all player characters
   */
  async syncAllCharacters() {
    if (!game.actors) {
      Logger.warn('Actors not available yet')
      return
    }

    const playerCharacters = game.actors.filter(actor =>
      this.shouldSyncActor(actor)
    )

    Logger.info(`Syncing ${playerCharacters.length} characters...`)

    for (const actor of playerCharacters) {
      await this.syncCharacter(actor)
    }

    Logger.info('Character sync complete')
  }

  /**
   * Determine if an actor should be synced
   */
  shouldSyncActor(actor) {
    // Sync all actors with type 'character' (PC sheets)
    // This includes characters not yet assigned to a player
    if (actor.type === 'character') {
      return true
    }

    // Optionally sync NPCs with specific flags
    if (actor.getFlag('tumulte-integration', 'syncToTumulte')) {
      return true
    }

    return false
  }

  /**
   * Sync a single character to Tumulte
   */
  async syncCharacter(actor) {
    try {
      // Build absolute URL for avatar image
      const avatarUrl = actor.img ? this.buildAbsoluteUrl(actor.img) : null

      const characterData = {
        worldId: game.world.id,
        campaignId: game.world.id,
        characterId: actor.id,
        name: actor.name,
        avatarUrl,
        characterType: actor.type === 'character' ? 'pc' : 'npc',
        stats: this.systemAdapter.extractStats(actor),
        inventory: this.systemAdapter.extractInventory(actor),
        vttData: {
          system: game.system.id,
          type: actor.type,
          flags: actor.flags
        }
      }

      const sent = this.socket.emit('character:update', characterData)

      if (sent) {
        this.syncedCharacters.set(actor.id, {
          lastSync: Date.now(),
          name: actor.name
        })

        Logger.debug('Character synced', { name: actor.name, id: actor.id })
      }

    } catch (error) {
      Logger.error('Failed to sync character', { actor: actor.name, error })
    }
  }

  /**
   * Handle actor update
   */
  onActorUpdate(actor, changes, options, userId) {
    if (!this.shouldSyncActor(actor)) return

    // Debounce updates to prevent spam
    this.debouncedSync(actor)
  }

  /**
   * Handle actor creation
   */
  onActorCreate(actor, options, userId) {
    if (!this.shouldSyncActor(actor)) return

    // Sync new character after a short delay
    setTimeout(() => this.syncCharacter(actor), 1000)
  }

  /**
   * Handle actor deletion
   */
  onActorDelete(actor, options, userId) {
    // Remove from synced characters
    this.syncedCharacters.delete(actor.id)

    // Clear any pending debounce
    if (this.syncDebounce.has(actor.id)) {
      clearTimeout(this.syncDebounce.get(actor.id))
      this.syncDebounce.delete(actor.id)
    }

    Logger.debug('Character removed from sync', { name: actor.name })
  }

  /**
   * Handle item changes (inventory updates)
   */
  onItemChange(item, options, userId) {
    const actor = item.parent
    if (!actor || actor.documentName !== 'Actor') return
    if (!this.shouldSyncActor(actor)) return

    // Debounce inventory updates
    this.debouncedSync(actor)
  }

  /**
   * Debounced sync to prevent update spam
   */
  debouncedSync(actor) {
    // Clear existing debounce timer
    if (this.syncDebounce.has(actor.id)) {
      clearTimeout(this.syncDebounce.get(actor.id))
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.syncCharacter(actor)
      this.syncDebounce.delete(actor.id)
    }, this.debounceDelay)

    this.syncDebounce.set(actor.id, timer)
  }

  /**
   * Get sync status for all characters
   */
  getSyncStatus() {
    const status = []

    for (const [id, data] of this.syncedCharacters) {
      status.push({
        id,
        name: data.name,
        lastSync: data.lastSync,
        age: Date.now() - data.lastSync
      })
    }

    return status
  }

  /**
   * Force resync all characters
   */
  async resyncAll() {
    this.syncedCharacters.clear()
    await this.syncAllCharacters()
  }

  /**
   * Build absolute URL from relative Foundry path
   * Handles both relative paths and already absolute URLs
   */
  buildAbsoluteUrl(path) {
    if (!path) return null

    // Already an absolute URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // Build absolute URL using Foundry's origin
    const origin = window.location.origin
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${origin}${cleanPath}`
  }
}

export default CharacterCollector
