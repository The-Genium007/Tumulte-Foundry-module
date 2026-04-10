/**
 * Minimal Foundry VTT type declarations for the Tumulte module.
 * Covers Foundry v12-v14 APIs used by this module.
 */

// ─── Core Globals ──────────────────────────────────────────────────────────────

declare const game: Game
declare const canvas: Canvas
declare const ui: UI
declare const Hooks: FoundryHooks
declare const CONFIG: Record<string, unknown>

// ─── Game ──────────────────────────────────────────────────────────────────────

interface Game {
  world: { id: string; title: string }
  user: GameUser
  system: { id: string; title: string; version: string }
  actors: ActorCollection
  combat: FoundryCombat | null
  messages: MessageCollection
  modules: Map<string, { version: string; active: boolean }>
  settings: GameSettings
  socket: unknown
  ready: boolean
  i18n?: { lang: string }
}

interface GameUser {
  id: string
  name: string
  isGM: boolean
}

interface GameSettings {
  register(moduleId: string, key: string, config: Record<string, unknown>): void
  registerMenu(moduleId: string, key: string, config: Record<string, unknown>): void
  get(moduleId: string, key: string): unknown
  set(moduleId: string, key: string, value: unknown): Promise<unknown>
}

// ─── Collections ───────────────────────────────────────────────────────────────

interface ActorCollection extends Iterable<FoundryActor> {
  get(id: string): FoundryActor | undefined
  map<T>(fn: (actor: FoundryActor) => T): T[]
  filter(fn: (actor: FoundryActor) => boolean): FoundryActor[]
  find(fn: (actor: FoundryActor) => boolean): FoundryActor | undefined
  forEach(fn: (actor: FoundryActor) => void): void
  size: number
}

interface MessageCollection {
  get(id: string): FoundryChatMessage | undefined
  filter(fn: (msg: FoundryChatMessage) => boolean): FoundryChatMessage[]
}

// ─── Actor ─────────────────────────────────────────────────────────────────────

interface FoundryActorSheet {
  render(force?: boolean, options?: Record<string, unknown>): unknown
}

interface FoundryActor {
  id: string
  name: string
  type: string
  img: string
  system: Record<string, unknown>
  items: FoundryItemCollection
  flags: Record<string, Record<string, unknown>>
  prototypeToken?: { texture?: { src?: string } }
  sheet?: FoundryActorSheet | null
  update(data: Record<string, unknown>): Promise<FoundryActor>
  getFlag(scope: string, key: string): unknown
  setFlag(scope: string, key: string, value: unknown): Promise<void>
  unsetFlag(scope: string, key: string): Promise<void>
}

interface FoundryItemCollection extends Iterable<FoundryItem> {
  get(id: string): FoundryItem | undefined
  filter(fn: (item: FoundryItem) => boolean): FoundryItem[]
  find(fn: (item: FoundryItem) => boolean): FoundryItem | undefined
  map<T>(fn: (item: FoundryItem) => T): T[]
  size: number
}

interface FoundryItem {
  id: string
  name: string
  type: string
  img: string
  system: Record<string, unknown>
  parent: (FoundryActor & { documentName: string }) | null
  actor?: FoundryActor | null
  update(data: Record<string, unknown>): Promise<FoundryItem>
  getFlag(scope: string, key: string): unknown
  setFlag(scope: string, key: string, value: unknown): Promise<void>
  unsetFlag(scope: string, key: string): Promise<void>
}

// ─── Chat Message ──────────────────────────────────────────────────────────────

interface FoundryChatMessage {
  id: string
  content: string
  speaker: ChatSpeaker
  rolls: FoundryRoll[]
  flags: Record<string, Record<string, unknown>>
  flavor?: string
  isRoll: boolean
  user: GameUser
  item?: FoundryItem | null
  getAssociatedItem?(): FoundryItem | null
  getFlag?(scope: string, key: string): unknown
  delete(): Promise<void>
}

interface ChatSpeaker {
  alias?: string
  actor?: string
  actorId?: string
  scene?: string
  token?: string
}

declare class ChatMessage {
  static create(data: Record<string, unknown>): Promise<FoundryChatMessage>
  static getSpeaker(options?: { actor?: FoundryActor }): ChatSpeaker
}

declare class Actor {
  static create(data: Record<string, unknown>): Promise<FoundryActor>
}

// ─── Roll System ───────────────────────────────────────────────────────────────

interface FoundryRoll {
  total: number | undefined
  formula: string
  terms: FoundryDiceTerm[]
  dice: FoundryDie[]
  result: string
  options?: Record<string, unknown>
  _evaluated: boolean
  // v14+ / system-specific enrichment
  isCritical?: boolean
  degreeOfSuccess?: number
}

interface FoundryDiceTerm {
  class?: string
  formula?: string
  results?: DieResult[]
  faces?: number
  number?: number
  terms?: FoundryDiceTerm[]
  rolls?: FoundryRoll[]
  operands?: FoundryDiceTerm[]
  operator?: string
  roll?: FoundryRoll
  term?: FoundryDiceTerm
}

interface FoundryDie {
  faces: number
  number: number
  results: DieResult[]
}

interface DieResult {
  result: number
  active: boolean
  discarded?: boolean
  rerolled?: boolean
}

declare class Roll {
  constructor(formula: string)
  total: number | undefined
  formula: string
  terms: FoundryDiceTerm[]
  dice: FoundryDie[]
  result: string
  _total: number | undefined
  _evaluated: boolean
  evaluate(): Promise<Roll>
  _evaluateTotal(): number
  toMessage(data?: Record<string, unknown>): Promise<FoundryChatMessage>
}

// ─── Combat ───────────────────────────────────────────────────────────────────

interface FoundryCombat {
  id: string
  round: number
  turn: number
  active: boolean
  combatant: FoundryCombatant | null
  combatants: FoundryCombatantCollection
  turns: FoundryCombatant[]
}

interface FoundryCombatant {
  id: string
  name: string
  img: string
  initiative: number | null
  isDefeated: boolean
  visible: boolean
  actor: FoundryActor | null
  combat: FoundryCombat | null
}

interface FoundryCombatantCollection {
  map<T>(fn: (combatant: FoundryCombatant) => T): T[]
  size: number
}

// ─── Canvas ────────────────────────────────────────────────────────────────────

interface Canvas {
  scene?: { name: string; id: string }
  tokens?: {
    placeables: CanvasToken[]
  }
}

interface CanvasTokenDocument {
  texture?: { src?: string }
  getFlag(scope: string, key: string): unknown
  setFlag(scope: string, key: string, value: unknown): Promise<void>
  unsetFlag(scope: string, key: string): Promise<void>
}

interface PIXIDisplayObject {
  filters: (PIXIFilterInstance | null)[] | null
  [key: string]: unknown
}

interface PIXIFilterInstance {
  color?: number
  _tumulteMonsterHalo?: boolean
  [key: string]: unknown
}

interface CanvasToken {
  actor?: FoundryActor
  document?: CanvasTokenDocument
  name?: string
  mesh?: PIXIDisplayObject | null
  filters: (PIXIFilterInstance | null)[] | null
  refresh(): void
  [key: string]: unknown
}

// ─── UI ────────────────────────────────────────────────────────────────────────

interface UI {
  notifications: {
    info(message: string): void
    warn(message: string): void
    error(message: string): void
  }
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

interface FoundryHooks {
  on(event: string, callback: (...args: unknown[]) => void): number
  once(event: string, callback: (...args: unknown[]) => void): number
  off(event: string, id: number): void
  callAll(event: string, ...args: unknown[]): boolean
}

// ─── FormApplication ───────────────────────────────────────────────────────────

declare class FormApplication {
  constructor(object?: Record<string, unknown>, options?: Record<string, unknown>)
  static get defaultOptions(): Record<string, unknown>
  get template(): string
  getData(): Record<string, unknown> | Promise<Record<string, unknown>>
  activateListeners(html: JQuery): void
  render(force?: boolean, options?: Record<string, unknown>): this
  close(options?: Record<string, unknown>): Promise<void>
  _updateObject(event: Event, formData: Record<string, unknown>): Promise<void>
  element: JQuery
  options: Record<string, unknown>
  object: Record<string, unknown>
}

// ─── PIXI (for glow filter) ────────────────────────────────────────────────────

declare namespace PIXI {
  class Filter {
    constructor(vertexSrc?: string, fragmentSrc?: string, uniforms?: Record<string, unknown>)
    uniforms: Record<string, unknown>
    enabled: boolean
    padding: number
    resolution: number
    autoFit: boolean
  }
}

// ─── Socket.IO (loaded as vendor script) ───────────────────────────────────────

declare function io(url: string, options?: Record<string, unknown>): SocketIOClient

interface SocketIOClient {
  connected: boolean
  id: string
  on(event: string, callback: (...args: unknown[]) => void): SocketIOClient
  off(event: string, callback?: (...args: unknown[]) => void): SocketIOClient
  emit(event: string, ...args: unknown[]): SocketIOClient
  connect(): SocketIOClient
  disconnect(): SocketIOClient
  removeAllListeners(event?: string): SocketIOClient
  io: {
    opts: Record<string, unknown>
    engine?: { transport?: { name?: string } }
  }
}

// ─── jQuery (used by FormApplication) ──────────────────────────────────────────

interface JQuery {
  find(selector: string): JQuery
  on(event: string, handler: (e: Event) => void): JQuery
  on(event: string, selector: string, handler: (e: Event) => void): JQuery
  val(): string | number | string[] | undefined
  val(value: string | number | string[]): JQuery
  text(): string
  text(value: string): JQuery
  html(): string
  html(value: string): JQuery
  attr(name: string): string | undefined
  attr(name: string, value: string): JQuery
  addClass(className: string): JQuery
  removeClass(className: string): JQuery
  toggleClass(className: string): JQuery
  hasClass(className: string): boolean
  show(): JQuery
  hide(): JQuery
  prop(name: string): unknown
  prop(name: string, value: unknown): JQuery
  closest(selector: string): JQuery
  data(key: string): unknown
  length: number
  [index: number]: HTMLElement
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

interface DialogConfirmOptions {
  title: string
  content: string
  yes?: () => unknown
  no?: () => unknown
  defaultYes?: boolean
}

declare class Dialog {
  constructor(data: DialogData, options?: Record<string, unknown>)
  static confirm(options: DialogConfirmOptions): Promise<unknown>
  render(force?: boolean): this
  close(options?: Record<string, unknown>): Promise<void>
}

interface DialogButton {
  icon?: string
  label?: string
  callback?: (...args: unknown[]) => unknown
}

interface DialogData {
  title: string
  content: string
  buttons: Record<string, DialogButton>
  default?: string
  close?: () => void
}

// ─── Foundry Utils ─────────────────────────────────────────────────────────────

declare namespace foundry {
  namespace utils {
    function mergeObject<T extends Record<string, unknown>>(
      original: T,
      other: Partial<T>,
      options?: Record<string, unknown>
    ): T
  }
}
