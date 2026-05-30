import type * as THREE from 'three';

// === Constants ===
/** X/Z dimensions of a chunk in blocks. */
export const CHUNK_SIZE = 16;
/** Y dimension; world is bounded vertically [0, CHUNK_HEIGHT). */
export const CHUNK_HEIGHT = 96;
/** Render distance in chunks (radius around player). */
export const RENDER_DISTANCE = 6;
/** Master world seed; deterministic generation. */
export const WORLD_SEED = 1337;
/** Gravity acceleration in blocks/s^2 (negative = downward). */
export const GRAVITY = -28;
/** Total player height in blocks (feet to top of head). */
export const PLAYER_HEIGHT = 1.8;
/** Eye height above feet, used for camera placement. */
export const PLAYER_EYE = 1.62;
/** Half-extent on X/Z for AABB collision. */
export const PLAYER_RADIUS = 0.3;
/** Terminal velocity for falling (positive magnitude). */
export const MAX_FALL_SPEED = 50;
/** Walking speed in blocks/s. */
export const WALK_SPEED = 4.3;
/** Sprinting speed in blocks/s. */
export const SPRINT_SPEED = 6.5;
/** Initial vertical velocity on jump in blocks/s. */
export const JUMP_VELOCITY = 9.2;
/** Maximum raycast distance for break/place actions in blocks. */
export const REACH = 5;
/** Real-time seconds for one full day→night→day cycle. Tunable. */
export const DAY_LENGTH_SECONDS = 180;
/** Player max health in half-heart points (20 = 10 hearts). */
export const PLAYER_MAX_HEALTH = 20;
/** Seconds of post-respawn invulnerability so the player isn't instantly re-killed. */
export const PLAYER_RESPAWN_INVULN_S = 1.5;
/** Fall distance (blocks) the player can drop without taking damage. */
export const FALL_DAMAGE_SAFE_BLOCKS = 3;
/** Damage (half-heart points) per block fallen beyond FALL_DAMAGE_SAFE_BLOCKS. */
export const FALL_DAMAGE_PER_BLOCK = 1;
/** Max downward drop (blocks) a mob will willingly step off. Steps over deeper drops are vetoed by Mob.avoidLedge so mobs don't walk off cliffs. Matches the player's fall-damage-free threshold. */
export const MOB_MAX_SAFE_DROP = 3;
/** Seconds without taking damage before passive health regeneration begins (survival only). */
export const HEALTH_REGEN_DELAY_S = 6;
/** Seconds per half-heart restored once regeneration is active. */
export const HEALTH_REGEN_INTERVAL_S = 1.5;
/** Seconds the player can stay fully submerged before drowning damage begins (survival only). */
export const PLAYER_MAX_AIR_S = 15;
/** Damage (half-heart points) per drowning tick once air is depleted. */
export const DROWN_DAMAGE = 2;
/** Seconds between consecutive drowning damage ticks. */
export const DROWN_INTERVAL_S = 1;
/** Max simultaneous live hostile mobs (zombies) at night. */
export const ZOMBIE_MAX_COUNT = 8;
/** Horizontal distance (blocks) within which a zombie begins chasing the player. */
export const ZOMBIE_DETECT_RADIUS = 16;
/** Horizontal distance (blocks) at which a zombie can bite the player. */
export const ZOMBIE_ATTACK_RANGE = 1.2;
/** Damage (half-heart points) per zombie bite. */
export const ZOMBIE_ATTACK_DAMAGE = 3;
/** Seconds between consecutive bites from the same zombie. */
export const ZOMBIE_ATTACK_COOLDOWN_S = 1.0;
/** Zombie horizontal speed while chasing (blocks/s). Must keep speed*1/60 < radius(0.3) to avoid tunneling. */
export const ZOMBIE_CHASE_SPEED = 2.4;
/** Damage (half-heart points) the player deals per melee hit. */
export const PLAYER_ATTACK_DAMAGE = 4;
/** Max distance (blocks) from the eye at which a melee swing can reach a mob. Below REACH(5). */
export const PLAYER_ATTACK_RANGE = 3.5;
/** Minimum seconds between player melee swings. */
export const PLAYER_ATTACK_COOLDOWN_S = 0.4;
/** Horizontal speed (blocks/s) imparted to a mob when hit, directed away from the attacker. */
export const MOB_KNOCKBACK_SPEED = 6;
/** Vertical pop (blocks/s) added to a grounded mob when hit, for a small hop. */
export const MOB_KNOCKBACK_POP = 4;
/** Seconds a mob is stunned after a hit: its AI think() is suppressed so the knockback impulse isn't overwritten. */
export const MOB_KNOCKBACK_DURATION_S = 0.3;
/** Zombie health in half-heart points (dies in 2 player hits at PLAYER_ATTACK_DAMAGE=4). */
export const ZOMBIE_MAX_HEALTH = 8;
/** Passive animal (cow/pig/sheep) health in half-heart points. */
export const PASSIVE_MOB_HEALTH = 10;
/** Horizontal speed (blocks/s) a passive mob flees at after being hit. */
export const PASSIVE_FLEE_SPEED = 3.5;
/** Seconds a passive mob keeps fleeing from the last hit source. */
export const PASSIVE_FLEE_DURATION_S = 4;

// === Hunger system (survival only) ===
/** Player max hunger in half-drumstick points (20 = 10 drumsticks), mirrors PLAYER_MAX_HEALTH. */
export const PLAYER_MAX_HUNGER = 20;
/** Passive health regeneration only activates when hunger is at or above this value. */
export const HUNGER_REGEN_THRESHOLD = 18;
/** Exhaustion units required to drain 1 hunger point. */
export const EXHAUSTION_PER_HUNGER = 4.0;
/** Passive exhaustion accumulated per second while alive. */
export const EXHAUSTION_IDLE_PER_S = 0.005;
/** Exhaustion accumulated per block of horizontal movement while walking. */
export const EXHAUSTION_WALK_PER_BLOCK = 0.01;
/** Exhaustion accumulated per block of horizontal movement while sprinting. */
export const EXHAUSTION_SPRINT_PER_BLOCK = 0.1;
/** Exhaustion added per jump. */
export const EXHAUSTION_JUMP = 0.2;
/** Exhaustion added per half-heart passively regenerated. */
export const EXHAUSTION_PER_HEAL = 6.0;
/** Damage (half-heart points) dealt per starvation tick at 0 hunger. */
export const STARVE_DAMAGE = 1;
/** Seconds between consecutive starvation ticks when hunger is 0. */
export const STARVE_INTERVAL_S = 4.0;
/** Starvation never reduces HP below this value (player cannot starve to death). */
export const STARVE_FLOOR_HP = 1;
/** Seconds of holding right-click required to finish eating a food item. */
export const EAT_DURATION_S = 1.6;

// === Skeleton (ranged hostile) ===
/** Max simultaneous live skeletons at night (separate cap from zombies). */
export const SKELETON_MAX_COUNT = 4;
/** Skeleton health in half-heart points (dies in 2 player hits at PLAYER_ATTACK_DAMAGE=4). */
export const SKELETON_MAX_HEALTH = 8;
/** Horizontal distance (blocks) within which a skeleton engages the player. */
export const SKELETON_DETECT_RADIUS = 20;
/** Below this horizontal distance (blocks) the skeleton backs away to keep range. */
export const SKELETON_PREFERRED_MIN = 5;
/** Above this horizontal distance (blocks, but within detect) the skeleton advances. */
export const SKELETON_PREFERRED_MAX = 12;
/** Skeleton horizontal move speed (blocks/s). Keep speed/60 < radius(0.3) to avoid tunneling. */
export const SKELETON_MOVE_SPEED = 2.0;
/** Seconds between consecutive arrow shots from the same skeleton. */
export const SKELETON_SHOOT_COOLDOWN_S = 2.0;

// === Arrow projectile ===
/** Arrow flight speed (blocks/s). Straight-line, no gravity. Keep speed/60 < 2*(PLAYER_RADIUS+ARROW_HIT_RADIUS) (≈1.1) for reliable per-tick hit detection (at 22 b/s, per-tick travel ≈0.367 blocks). */
export const ARROW_SPEED = 22;
/** Damage (half-heart points) an arrow deals to the player on hit. */
export const ARROW_DAMAGE = 4;
/** Seconds an arrow lives before despawning if it hits nothing. */
export const ARROW_LIFETIME_S = 3;
/** Collision half-extent (blocks) added around the player AABB for the arrow point-hit test. */
export const ARROW_HIT_RADIUS = 0.25;

// === Block-break particles ===
/** Particles spawned per block break. */
export const PARTICLE_BURST_COUNT = 12;
/** Seconds each particle lives before it is recycled. */
export const PARTICLE_LIFETIME_S = 0.6;
/** Downward acceleration on particles (blocks/s^2). */
export const PARTICLE_GRAVITY = 16;
/** Initial speed scale (blocks/s) for the random burst velocity. */
export const PARTICLE_SPEED = 2.5;
/** Particle point size in world units (PointsMaterial with sizeAttenuation). */
export const PARTICLE_SIZE = 0.14;
/** Max simultaneous live particles. The pool is preallocated to this size; bursts past it are dropped. */
export const PARTICLE_POOL_MAX = 256;

/** Number of progressive crack stages drawn on a block as it's mined (Minecraft-style destroy stages). */
export const BREAK_OVERLAY_STAGES = 10;
/** Max items in one inventory stack. */
export const MAX_STACK = 64;
/** Total inventory slots: 9 hotbar + 27 main grid. */
export const INVENTORY_SIZE = 36;
/** First N slots of the inventory array are the hotbar. */
export const HOTBAR_SIZE = 9;
/** Crafting grid is square: CRAFTING_GRID_DIM x CRAFTING_GRID_DIM. */
export const CRAFTING_GRID_DIM = 3;
/** Total crafting input slots (DIM*DIM). */
export const CRAFTING_GRID_SLOTS = 9;
/** Seconds after spawning before a dropped item can be collected (so the dropper doesn't immediately re-pick it up). */
export const DROPPED_ITEM_PICKUP_DELAY_S = 0.5;
/** Horizontal radius (blocks) within which a dropped item is vacuumed toward the player. */
export const DROPPED_ITEM_ATTRACT_RADIUS = 3.5;
/** Radius (blocks) within which a vacuuming item is actually collected into the inventory. */
export const DROPPED_ITEM_PICKUP_RADIUS = 1.0;
/** Speed (blocks/s) at which an item moves toward the player while being attracted. */
export const DROPPED_ITEM_ATTRACT_SPEED = 6;
/** Seconds before an uncollected dropped item despawns. */
export const DROPPED_ITEM_LIFETIME_S = 300;

// === Block IDs (numeric for TypedArray storage) ===
export const BlockId = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  WOOD: 5,
  LEAVES: 6,
  PLANKS: 7,
  SAND: 8,
  GLASS: 9,
  BEDROCK: 10,
  WATER: 11,
  SNOW: 12,
  COAL_ORE: 13,
  IRON_ORE: 14,
} as const;
export type BlockId = typeof BlockId[keyof typeof BlockId];

// === Item IDs ===
// A non-block item id starts at 100. Block items are represented by their BlockId
// numeric value (0..14) directly, so a persisted block stack {block,count} reads
// back as {item,count} with item === block. ItemId is therefore the numeric union
// of "any BlockId" plus these non-block ids.
export const ItemId = {
  STICK: 100,
  WOODEN_PICKAXE: 101,
  WOODEN_AXE: 102,
  WOODEN_SHOVEL: 103,
  STONE_PICKAXE: 104,
  STONE_AXE: 105,
  STONE_SHOVEL: 106,
  // 107-109 reserved for future tools
  RAW_BEEF: 110,
  RAW_PORKCHOP: 111,
  RAW_CHICKEN: 112,
  RAW_MUTTON: 113,
} as const;
/** A BlockId value (0..14) OR one of the ItemId.* non-block ids (>=100). */
export type ItemId = number;

// === Tools ===
export const ToolKind = {
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
} as const;
export type ToolKind = (typeof ToolKind)[keyof typeof ToolKind];

/** Tool behavior: which block category it speeds up, and by how much. */
export interface ToolDef {
  kind: ToolKind;
  /** Mining-time divisor when used on a block in this tool's category (>1 = faster). */
  speedMultiplier: number;
}

/** Food behavior: how much hunger is restored when the item is fully eaten. */
export interface FoodDef {
  /** Half-hunger points restored when eaten. */
  hungerRestore: number;
}

/** Per-item metadata. Block items synthesize this from their BlockId; non-block items have static defs. */
export interface ItemDef {
  id: ItemId;
  name: string;
  maxStack: number;
  /** sRGB hex string (e.g. '#8a5a2b') used for the hotbar/inventory slot swatch. */
  swatchColor: string;
  /** 1-char label drawn on the slot for non-block items; '' for block items (which render a plain swatch). */
  glyph: string;
  /** Block this item places on right-click, or null if it is not placeable (sticks, tools). */
  placeable: BlockId | null;
  /** Tool behavior if this item is a tool, else null. */
  tool: ToolDef | null;
  /** Food behavior if this item is edible, else null. */
  food: FoodDef | null;
}

// === Block definition (registry entry) ===
export interface BlockDef {
  id: BlockId;
  name: string;
  /** Collides with player; AIR and non-solid blocks (e.g. future water) are false. */
  solid: boolean;
  /** Mesher should still draw faces between this and air; e.g. leaves, glass. */
  transparent: boolean;
  /** Atlas tile indices for each face. Mesher picks based on face normal. */
  textures: { top: number; bottom: number; side: number };
  /** sRGB hex tint used for the break-particle burst of this block. */
  particleColor: number;
  /** Seconds to mine this block by hand at base speed. Infinity = unbreakable (bedrock). AIR/WATER unused. */
  hardness: number;
}

/** A stack of a single item type held in an inventory slot or carried by a dropped item. item is never AIR for a real stack; count is in [1, item's maxStack]. */
export interface ItemStack {
  item: ItemId;
  count: number;
}

/** A crafting recipe. Shaped recipes match a trimmed grid (with horizontal mirror); shapeless match a multiset of ingredients. */
export type Recipe =
  | { kind: 'shaped'; pattern: (ItemId | null)[]; width: number; height: number; output: ItemStack }
  | { kind: 'shapeless'; ingredients: ItemId[]; output: ItemStack };

// === Day/night cycle ===
/**
 * Lighting + sky parameters for the current time of day. Produced by DayNightCycle
 * and consumed by Renderer.applySky().
 *
 * IMPORTANT: the THREE objects below are REUSED across frames (the producer mutates
 * the same instances every tick to avoid per-frame allocations). Consumers must copy
 * the values out (e.g. `target.copy(state.skyColor)`) and must NOT retain the references.
 */
export interface SkyState {
  /** Sky/background color; also applied to fog color and the renderer clear color. */
  readonly skyColor: THREE.Color;
  /** Directional ("sun") light color. */
  readonly sunColor: THREE.Color;
  /** Directional light intensity (≈0 at night). */
  sunIntensity: number;
  /** Ambient light intensity. Never 0 — keeps night navigable. */
  ambientIntensity: number;
  /** Unit vector: the direction sunlight TRAVELS (from the sun toward the scene). The directional light is positioned on the opposite side (at -sunDirection * distance). */
  readonly sunDirection: THREE.Vector3;
}

// === Vec3 (plain object for ergonomics; Three.js Vector3 used internally where needed) ===
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// === Raycast result ===
export interface BlockHit {
  /** Integer coords of the block that was hit. */
  block: { x: number; y: number; z: number };
  /** Unit-length face normal of the side that was hit (one axis +/-1, others 0). Used to compute placement position = block + normal. */
  normal: { x: number; y: number; z: number };
  /** World-space hit point. */
  point: Vec3;
  /** Distance from ray origin. */
  distance: number;
}

// === World interface (player & interaction depend on this; world implements it) ===
export interface IWorld {
  /** Returns BlockId.AIR for out-of-bounds (above CHUNK_HEIGHT or below 0) and unloaded chunks. */
  getBlock(x: number, y: number, z: number): BlockId;
  /** Sets the block. Triggers re-mesh of the chunk and any neighboring chunks if on a border. No-op if chunk not loaded. May trigger cascading block updates (unsupported sand falls; removing a log decays orphaned leaves); all resulting chunk remeshes are batched into this call. */
  setBlock(x: number, y: number, z: number, id: BlockId): void;
  /** True if the block at integer coords is solid (per BlockDef.solid). Out-of-bounds: false. */
  isSolid(x: number, y: number, z: number): boolean;
  /** DDA raycast through the voxel grid. Returns null if no solid block hit within maxDistance. */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): BlockHit | null;
  /** The current chase target for hostile mobs (the local player's FEET position), or null if none set. The returned object is a LIVE reference that mutates each tick — read it, do not retain across ticks expecting a snapshot. */
  getTrackedTarget(): Vec3 | null;
  setTrackedTarget(target: Vec3 | null): void;
  /** Stream chunks around playerPos: load missing within RENDER_DISTANCE, unload outside. */
  update(playerPos: Vec3): void;
  /** Three.js group containing all chunk meshes. Add this to the scene once. */
  readonly group: THREE.Group;
}

// === Block registry helper (world implements; others read) ===
export interface IBlockRegistry {
  get(id: BlockId): BlockDef;
  isSolid(id: BlockId): boolean;
  isTransparent(id: BlockId): boolean;
}

// === Player input state (controls produce; physics consumes) ===
export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  /** Yaw in radians; mouse look. */
  yaw: number;
  /** Pitch in radians; clamped to [-PI/2+0.01, PI/2-0.01]. */
  pitch: number;
}

// === Player state ===
export interface PlayerState {
  /** FEET position (not eyes). */
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  /** Hotbar index in [0, 8]. */
  selectedSlot: number;
  /** Current health in half-heart points, clamped to [0, PLAYER_MAX_HEALTH]. Not persisted; resets to full each load. */
  health: number;
  /** Half-drumstick points, clamped [0, PLAYER_MAX_HUNGER]. Not persisted; resets to full each load. */
  hunger: number;
}

// === Texture atlas: returns UV rect for a given tile index ===
export interface ITextureAtlas {
  /** UV rect in atlas: [u0, v0, u1, v1]. Origin bottom-left, range [0,1]. */
  getUV(tileIndex: number): [number, number, number, number];
  /** The atlas Three.js texture, ready to assign to a material. */
  readonly texture: THREE.Texture;
  /** Tile dimensions for shader use. */
  readonly tileCount: number;
}

// === App state machine ===
export type AppState =
  | 'main_menu'
  | 'worlds'
  | 'create_world'
  | 'in_game'
  | 'paused'
  | 'dead'
  | 'settings';

// === Game mode ===
export const GameMode = {
  SURVIVAL: 'survival',
  CREATIVE: 'creative',
} as const;
export type GameMode = typeof GameMode[keyof typeof GameMode];

// === Settings ===
export interface Settings {
  renderDistance: number;
  fov: number;
  mouseSensitivity: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  invertY: boolean;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: RENDER_DISTANCE,
  fov: 75,
  mouseSensitivity: 1.0,
  masterVolume: 1.0,
  musicVolume: 0.5,
  sfxVolume: 1.0,
  invertY: false,
  showFps: true,
};

export const SETTINGS_RANGES = {
  renderDistance: { min: 2, max: 16, step: 1 },
  fov: { min: 60, max: 110, step: 1 },
  mouseSensitivity: { min: 0.25, max: 3.0, step: 0.05 },
  masterVolume: { min: 0, max: 1, step: 0.05 },
  musicVolume: { min: 0, max: 1, step: 0.05 },
  sfxVolume: { min: 0, max: 1, step: 0.05 },
} as const;

// === World save ===
/** Stored per-world; serialized into IndexedDB. */
export interface WorldMetadata {
  /** Unique key — same as the user-typed name; collisions disallowed at create time. */
  name: string;
  /** Deterministic u32 seed derived from name (+ optional user-typed seed). */
  seed: number;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms; updated on every save. */
  lastPlayed: number;
  gameMode: GameMode;
  /** Where the player was when last saved (FEET position). */
  playerPosition: Vec3;
  playerYaw: number;
  playerPitch: number;
  selectedSlot: number;
  /** Persisted inventory: INVENTORY_SIZE slots, null = empty. Slots are {item,count}; legacy saves used {block,count} (numerically identical for block items, so readable by reading item ?? block). Absent on Creative worlds. */
  inventory?: (ItemStack | null)[];
}

/** Sparse map of player edits per chunk. Key format: `${cx},${cz}`; value is array of [linearIndex, BlockId] tuples. */
export type ChunkOverrides = Record<string, [number, BlockId][]>;

export interface WorldSave {
  metadata: WorldMetadata;
  overrides: ChunkOverrides;
}

// === Entity system ===
export const EntityKind = {
  LOCAL_PLAYER: 'local_player',
  REMOTE_PLAYER: 'remote_player',
  MOB: 'mob',
  ZOMBIE: 'zombie',
  COW: 'cow',
  PIG: 'pig',
  SHEEP: 'sheep',
  CHICKEN: 'chicken',
  SKELETON: 'skeleton',
  ARROW: 'arrow',
  DROPPED_ITEM: 'dropped_item',
} as const;
export type EntityKind = typeof EntityKind[keyof typeof EntityKind];

/**
 * A pending arrow shot produced by a Skeleton's AI and consumed by GameSession to
 * spawn an Arrow. `origin` is the launch point (the skeleton's bow height in world
 * space); `dir` is the NORMALIZED flight direction. This shared type lets Skeleton
 * and GameSession communicate without importing each other (mirrors the Zombie.tryBite
 * delegation pattern).
 */
export interface ArrowShot {
  origin: Vec3;
  dir: Vec3;
}

/** Minimal entity interface. Anything that lives in the world implements this. */
export interface IEntity {
  /** Assigned by EntityManager.spawn(); read-only by convention from outside the manager. */
  id: number;
  readonly kind: EntityKind;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  /** Optional Three.js object that, if present, EntityManager adds to / removes from the world group. */
  readonly object3D: import('three').Object3D | null;
  /** Per-tick update. dt is in seconds. */
  update(dt: number, world: IWorld): void;
  /** Cleanup; called on despawn or world unload. Dispose meshes/materials here. */
  dispose(): void;
}

export interface IEntityManager {
  spawn(entity: IEntity): number;
  despawn(id: number): void;
  get(id: number): IEntity | undefined;
  /** All entities (for read-only iteration). */
  readonly all: ReadonlyArray<IEntity>;
  /** Tick all entities. Called by World.update(). */
  update(dt: number, world: IWorld): void;
  /** Despawn and dispose everything. */
  clear(): void;
}

// === Network foundation ===
/** Wire-protocol messages. Only types — no behavior. */
export type NetworkMessage =
  | { type: 'hello'; protocolVersion: number; clientName: string }
  | { type: 'welcome'; assignedId: number; tickRate: number }
  | { type: 'entity_spawn'; entityId: number; kind: EntityKind; position: Vec3; yaw: number }
  | { type: 'entity_despawn'; entityId: number }
  | { type: 'entity_state'; entityId: number; position: Vec3; velocity: Vec3; yaw: number; pitch: number }
  | { type: 'block_set'; x: number; y: number; z: number; block: BlockId }
  | { type: 'chat'; from: string; text: string };

export const PROTOCOL_VERSION = 1;

export interface INetworkAdapter {
  /** True if the adapter has an active connection (or is acting as a local stub). */
  readonly connected: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  send(msg: NetworkMessage): void;
  /** Subscribe to inbound messages. Returns an unsubscribe fn. */
  onMessage(handler: (msg: NetworkMessage) => void): () => void;
}
