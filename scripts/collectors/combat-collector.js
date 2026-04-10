/**
 * Combat Collector
 * Tracks combat state and sends updates to Tumulte
 */
import Logger from '../utils/logger.js';
import { classifyActor } from '../utils/actor-classifier.js';
// ─── Class ────────────────────────────────────────────────────────────────────
export class CombatCollector {
    socket;
    activeCombat;
    _initialized;
    constructor(socketClient) {
        this.socket = socketClient;
        this.activeCombat = null;
        this._initialized = false;
    }
    /**
     * Initialize the collector (idempotent -- safe to call on reconnection)
     */
    initialize() {
        if (this._initialized) {
            Logger.debug('Combat Collector already initialized, skipping hook registration');
            // Still sync active combat on reconnection
            this.syncActiveCombat();
            return;
        }
        // Combat lifecycle hooks
        Hooks.on('createCombat', this.onCombatCreate.bind(this));
        Hooks.on('updateCombat', this.onCombatUpdate.bind(this));
        Hooks.on('deleteCombat', this.onCombatDelete.bind(this));
        // Combat turn/round hooks
        Hooks.on('combatStart', this.onCombatStart.bind(this));
        Hooks.on('combatTurn', this.onTurnChange.bind(this));
        Hooks.on('combatRound', this.onRoundChange.bind(this));
        // Combatant hooks
        Hooks.on('createCombatant', this.onCombatantCreate.bind(this));
        Hooks.on('deleteCombatant', this.onCombatantDelete.bind(this));
        Hooks.on('updateCombatant', this.onCombatantUpdate.bind(this));
        // Scene change hook -- re-sync combat when the active scene changes
        Hooks.on('canvasReady', this.onSceneChange.bind(this));
        this._initialized = true;
        Logger.info('Combat Collector initialized');
        // Sync active combat if one exists (game is already ready when this is called)
        this.syncActiveCombat();
    }
    /**
     * Sync active combat if one is in progress
     */
    syncActiveCombat() {
        const combat = game.combat;
        if (!combat || !combat.active) {
            Logger.debug('No active combat to sync');
            return;
        }
        Logger.info('Syncing active combat', {
            id: combat.id,
            round: combat.round,
            turn: combat.turn
        });
        this.activeCombat = combat.id;
        // Send current combat state
        const payload = {
            worldId: game.world.id,
            combatId: combat.id,
            round: combat.round,
            turn: combat.turn,
            combatants: this.extractCombatants(combat),
            currentCombatant: combat.combatant ? this.extractCombatantData(combat.combatant) : null,
            timestamp: Date.now()
        };
        this.socket.emit('combat:sync', payload);
    }
    /**
     * Handle scene change (canvasReady) -- re-sync or clear combat for the new scene.
     *
     * When the GM switches to a different scene:
     * - If the new scene has an active combat -> sync it (replaces Redis cache)
     * - If the new scene has no combat -> emit combat:end to clear Redis cache
     *   and trigger monster effect cleanup
     */
    onSceneChange(canvasArg) {
        const newSceneId = canvasArg.scene?.id;
        const combat = game.combat;
        Logger.info('Scene changed', {
            sceneId: newSceneId,
            sceneName: canvasArg.scene?.name,
            hasCombat: !!combat?.active,
            previousCombat: this.activeCombat,
        });
        if (combat?.active) {
            // New scene has an active combat -- sync it
            if (this.activeCombat !== combat.id) {
                // Different combat than before: cleanup old effects then sync new
                if (this.activeCombat) {
                    if (typeof this.socket.cleanupMonsterEffects === 'function') {
                        this.socket.cleanupMonsterEffects().catch((err) => {
                            Logger.error('Failed to cleanup monster effects on scene change', err);
                        });
                    }
                }
                this.activeCombat = combat.id;
                this.syncActiveCombat();
            }
            // Same combat (e.g. GM re-navigated to same scene) -- just re-sync
            else {
                this.syncActiveCombat();
            }
        }
        else {
            // No combat on new scene -- clear the previous one
            if (this.activeCombat) {
                Logger.info('No combat on new scene, clearing previous combat', {
                    previousCombatId: this.activeCombat,
                });
                const payload = {
                    worldId: game.world.id,
                    combatId: this.activeCombat,
                    finalRound: 0,
                    timestamp: Date.now()
                };
                this.socket.emit('combat:end', payload);
                // Cleanup monster effects from the previous scene
                if (typeof this.socket.cleanupMonsterEffects === 'function') {
                    this.socket.cleanupMonsterEffects().catch((err) => {
                        Logger.error('Failed to cleanup monster effects on scene change', err);
                    });
                }
                this.activeCombat = null;
            }
        }
    }
    /**
     * Handle combat creation
     */
    onCombatCreate(combat, _options, _userId) {
        Logger.debug('Combat created', { id: combat.id });
        this.activeCombat = combat.id;
    }
    /**
     * Handle combat start
     */
    onCombatStart(combat, _updateData) {
        Logger.info('Combat started', {
            id: combat.id,
            round: combat.round,
            combatants: combat.combatants.size
        });
        const payload = {
            worldId: game.world.id,
            combatId: combat.id,
            round: combat.round,
            turn: combat.turn,
            combatants: this.extractCombatants(combat),
            timestamp: Date.now()
        };
        this.socket.emit('combat:start', payload);
    }
    /**
     * Handle combat update
     */
    onCombatUpdate(combat, changes, _options, _userId) {
        // Only process significant changes
        if (!changes.round && !changes.turn && !changes.active) {
            return;
        }
        Logger.debug('Combat updated', {
            id: combat.id,
            changes
        });
    }
    /**
     * Handle turn change
     */
    onTurnChange(combat, prior, _options) {
        const current = combat.combatant;
        if (!current)
            return;
        Logger.info('Combat turn changed', {
            round: combat.round,
            turn: combat.turn,
            combatant: current.name
        });
        const payload = {
            worldId: game.world.id,
            combatId: combat.id,
            round: combat.round,
            turn: combat.turn,
            currentCombatant: this.extractCombatantData(current),
            nextCombatant: this.getNextCombatant(combat),
            timestamp: Date.now()
        };
        this.socket.emit('combat:turn', payload);
    }
    /**
     * Handle round change
     */
    onRoundChange(combat, prior, _options) {
        Logger.info('Combat round changed', {
            round: combat.round,
            previousRound: prior.round
        });
        const payload = {
            worldId: game.world.id,
            combatId: combat.id,
            round: combat.round,
            previousRound: prior.round,
            combatants: this.extractCombatants(combat),
            timestamp: Date.now()
        };
        this.socket.emit('combat:round', payload);
    }
    /**
     * Handle combat deletion (combat ends)
     */
    onCombatDelete(combat, _options, _userId) {
        Logger.info('Combat ended', { id: combat.id });
        const payload = {
            worldId: game.world.id,
            combatId: combat.id,
            finalRound: combat.round,
            timestamp: Date.now()
        };
        this.socket.emit('combat:end', payload);
        if (this.activeCombat === combat.id) {
            this.activeCombat = null;
        }
        // Auto-cleanup monster effects when combat ends
        if (typeof this.socket.cleanupMonsterEffects === 'function') {
            this.socket.cleanupMonsterEffects().catch((err) => {
                Logger.error('Failed to auto-cleanup monster effects on combat end', err);
            });
        }
    }
    /**
     * Handle new combatant
     */
    onCombatantCreate(combatant, _options, _userId) {
        const combat = combatant.combat;
        Logger.debug('Combatant added', {
            name: combatant.name,
            combatId: combat?.id
        });
        if (combat) {
            const payload = {
                worldId: game.world.id,
                combatId: combat.id,
                combatant: this.extractCombatantData(combatant),
                timestamp: Date.now()
            };
            this.socket.emit('combat:combatant-add', payload);
        }
    }
    /**
     * Handle combatant removal
     */
    onCombatantDelete(combatant, _options, _userId) {
        const combat = combatant.combat;
        Logger.debug('Combatant removed', {
            name: combatant.name,
            combatId: combat?.id
        });
        if (combat) {
            const payload = {
                worldId: game.world.id,
                combatId: combat.id,
                combatantId: combatant.id,
                name: combatant.name,
                timestamp: Date.now()
            };
            this.socket.emit('combat:combatant-remove', payload);
        }
    }
    /**
     * Handle combatant update (HP, defeated, etc.)
     */
    onCombatantUpdate(combatant, changes, _options, _userId) {
        // Only send significant updates
        if (!changes.defeated && !changes.initiative) {
            return;
        }
        const combat = combatant.combat;
        if (!combat)
            return;
        Logger.debug('Combatant updated', {
            name: combatant.name,
            changes
        });
        if (changes.defeated !== undefined) {
            const payload = {
                worldId: game.world.id,
                combatId: combat.id,
                combatant: this.extractCombatantData(combatant),
                defeated: changes.defeated,
                timestamp: Date.now()
            };
            this.socket.emit('combat:combatant-defeated', payload);
        }
    }
    /**
     * Extract all combatants data
     */
    extractCombatants(combat) {
        return combat.combatants.map((c) => this.extractCombatantData(c));
    }
    /**
     * Extract data for a single combatant
     */
    extractCombatantData(combatant) {
        const actor = combatant.actor;
        const characterType = actor ? classifyActor(actor) : 'npc';
        return {
            id: combatant.id,
            actorId: actor?.id,
            name: combatant.name,
            img: combatant.img || actor?.img || '',
            initiative: combatant.initiative,
            isDefeated: combatant.isDefeated,
            isNPC: characterType !== 'pc',
            characterType,
            isVisible: combatant.visible,
            hp: actor ? this.extractHP(actor) : null
        };
    }
    /**
     * Extract HP from actor (multi-system support)
     */
    extractHP(actor) {
        const s = actor.system;
        if (!s)
            return null;
        // D&D 5e / PF2e / Generic (system.attributes.hp)
        const attributes = s.attributes;
        const attrHp = attributes?.hp;
        if (attrHp) {
            return { current: attrHp.value ?? 0, max: attrHp.max ?? 0, temp: attrHp.temp || 0 };
        }
        // CoC7 (system.hp)
        const hp = s.hp;
        if (hp?.value !== undefined) {
            return { current: hp.value ?? 0, max: hp.max ?? 0, temp: 0 };
        }
        // WFRP4e (system.status.wounds)
        const status = s.status;
        const wounds = status?.wounds;
        if (wounds) {
            return { current: wounds.value ?? 0, max: wounds.max ?? 0, temp: 0 };
        }
        // SWADE (system.wounds)
        const sWounds = s.wounds;
        if (sWounds?.value !== undefined && sWounds?.max !== undefined) {
            return { current: sWounds.value ?? 0, max: sWounds.max ?? 0, temp: 0 };
        }
        // Cyberpunk RED (system.derivedStats.hp)
        const derivedStats = s.derivedStats;
        const derivedHp = derivedStats?.hp;
        if (derivedHp) {
            return { current: derivedHp.value ?? 0, max: derivedHp.max ?? 0, temp: 0 };
        }
        // Alien RPG (system.header.health)
        const header = s.header;
        const health = header?.health;
        if (health) {
            return { current: health.value ?? 0, max: health.max ?? 0, temp: 0 };
        }
        // Star Wars FFG (system.stats.wounds)
        const stats = s.stats;
        const statsWounds = stats?.wounds;
        if (statsWounds) {
            return { current: statsWounds.value ?? 0, max: statsWounds.max ?? 0, temp: 0 };
        }
        // Shadowrun (system.track.physical)
        const track = s.track;
        const physical = track?.physical;
        if (physical) {
            return { current: physical.value ?? 0, max: physical.max ?? 0, temp: 0 };
        }
        // Forbidden Lands (system.attribute.strength = HP)
        const attribute = s.attribute;
        const strength = attribute?.strength;
        if (strength) {
            return { current: strength.value ?? 0, max: strength.max ?? 0, temp: 0 };
        }
        // Vaesen (system.condition.physical)
        const condition = s.condition;
        const condPhysical = condition?.physical;
        if (condPhysical) {
            return { current: condPhysical.value ?? 0, max: condPhysical.max ?? 0, temp: 0 };
        }
        // VtM5e / WoD5e (system.health)
        const vtmHealth = s.health;
        if (vtmHealth?.value !== undefined) {
            return { current: vtmHealth.value ?? 0, max: vtmHealth.max ?? 0, temp: 0 };
        }
        // KULT (system.wounds — serious wounds counter, max 4 before critical)
        const kultWounds = s.wounds;
        if (kultWounds?.serious !== undefined) {
            return { current: 4 - (kultWounds.serious ?? 0), max: 4, temp: 0 };
        }
        // Blades in the Dark (system.stress — proxy HP)
        const stress = s.stress;
        if (stress?.value !== undefined && stress?.max !== undefined) {
            return { current: stress.max - (stress.value ?? 0), max: stress.max ?? 9, temp: 0 };
        }
        // FATE Core (system.tracks — stress tracks as proxy HP)
        const tracks = s.tracks;
        if (tracks && Array.isArray(tracks)) {
            const stressTracks = tracks.filter(t => t.type === 'stress');
            if (stressTracks.length > 0) {
                let totalBoxes = 0;
                let usedBoxes = 0;
                for (const track of stressTracks) {
                    const boxes = track.boxes ?? 0;
                    totalBoxes += boxes;
                    if (track.box_values && Array.isArray(track.box_values)) {
                        usedBoxes += track.box_values.filter(v => v === null).length;
                    }
                }
                return { current: totalBoxes - usedBoxes, max: totalBoxes, temp: 0 };
            }
        }
        // City of Mist (Dangers: statuses as proxy HP — count active statuses tier)
        const comStatuses = s.statuses;
        if (comStatuses && Array.isArray(comStatuses)) {
            let maxTier = 0;
            for (const st of comStatuses) {
                if (typeof st.tier === 'number' && st.tier > maxTier)
                    maxTier = st.tier;
            }
            // Spectrum is typically 4-5 tiers for Dangers; use 5 as default max
            const spectrum = s.spectrum ?? 5;
            return { current: spectrum - maxTier, max: spectrum, temp: 0 };
        }
        return null;
    }
    /**
     * Get next combatant in turn order
     */
    getNextCombatant(combat) {
        const turns = combat.turns;
        const currentIndex = combat.turn;
        if (!turns || turns.length === 0)
            return null;
        const nextIndex = (currentIndex + 1) % turns.length;
        const nextCombatant = turns[nextIndex];
        return nextCombatant ? this.extractCombatantData(nextCombatant) : null;
    }
    /**
     * Get current combat status
     */
    getStatus() {
        const combat = game.combat;
        if (!combat) {
            return { active: false };
        }
        return {
            active: combat.active,
            id: combat.id,
            round: combat.round,
            turn: combat.turn,
            combatantsCount: combat.combatants.size,
            currentCombatant: combat.combatant?.name
        };
    }
}
export default CombatCollector;
//# sourceMappingURL=combat-collector.js.map