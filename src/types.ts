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
/** Maximum sky-light level; the light engine uses 0..MAX_SKY_LIGHT for sky light propagation. */
export const MAX_SKY_LIGHT = 15;
/** Light emission level of a torch block (0..15). */
export const TORCH_LIGHT = 14;
/** Light emission level of a glowstone block (0..15). Brighter than a torch — full strength. */
export const GLOWSTONE_LIGHT = 15;
/** Block-light level emitted by a lava block (max, like glowstone). */
export const LAVA_LIGHT = 15;
/**
 * Sky-light → brightness multiplier LUT (index = light level 0..15).
 * 0 = deep shadow (a non-zero floor so caves aren't pure black), 15 = full daylight.
 * The mesher multiplies this into the per-vertex AO brightness when baking chunk colors.
 */
export const SKY_LIGHT_BRIGHTNESS: readonly number[] = [
  0.10, 0.13, 0.16, 0.20, 0.24, 0.29, 0.34, 0.40,
  0.46, 0.53, 0.60, 0.68, 0.76, 0.85, 0.93, 1.0,
];
/**
 * Block-light → emissive brightness LUT (index = block-light level 0..15).
 * Index 0 is EXACTLY 0 (no emitter nearby → no glow). Unlike SKY_LIGHT_BRIGHTNESS this has
 * NO non-zero floor: the chunk shader adds this channel as scene-light-independent warm
 * emissive, so any floor above 0 would make every surface self-glow and wash out night.
 */
export const BLOCK_LIGHT_BRIGHTNESS: readonly number[] = [
  0.0, 0.05, 0.09, 0.13, 0.18, 0.24, 0.30, 0.37,
  0.44, 0.52, 0.60, 0.69, 0.78, 0.87, 0.95, 1.0,
];
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
export const DAY_LENGTH_SECONDS = 600;
/** Normalized time-of-day a player wakes to after sleeping in a bed. Just past sunrise (0.25) so it reads as clearly daytime and hostiles stop spawning. */
export const MORNING_TIME = 0.28;
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
/** Default saturation on spawn / fresh load (mirrors hunger resetting to full). */
export const PLAYER_DEFAULT_SATURATION = 5;
/** Health-regen interval (s) while hunger is FULL and saturation > 0 — the "well-fed" fast heal. Must be < HEALTH_REGEN_INTERVAL_S. */
export const HEALTH_REGEN_FAST_INTERVAL_S = 0.5;
/** Seconds the player can stay fully submerged before drowning damage begins (survival only). */
export const PLAYER_MAX_AIR_S = 15;
/** Damage (half-heart points) per drowning tick once air is depleted. */
export const DROWN_DAMAGE = 2;
/** Seconds between consecutive drowning damage ticks. */
export const DROWN_INTERVAL_S = 1;
/** Damage (half-heart points) per lava-contact tick (survival only). Reduced by armor. */
export const LAVA_DAMAGE = 3;
/** Seconds between consecutive lava-contact damage ticks. */
export const LAVA_DAMAGE_INTERVAL_S = 0.5;
/** Lava floods carved cave-air at or below this world-Y during terrain generation (deep underground only). */
export const LAVA_GEN_MAX_Y = 6;
/** Damage (half-heart points) per cactus-contact tick (survival only). Reduced by armor. */
export const CACTUS_DAMAGE = 1;
/** Seconds between consecutive cactus-contact damage ticks. */
export const CACTUS_DAMAGE_INTERVAL_S = 0.5;
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
/** Melee damage multiplier when a hit lands mid-fall (airborne + descending). MC parity: +50% on a "critical" jump-attack. */
export const CRITICAL_HIT_MULTIPLIER = 1.5;
/** Max distance (blocks) from the eye at which a melee swing can reach a mob. Below REACH(5). */
export const PLAYER_ATTACK_RANGE = 3.5;
/** Minimum seconds between player melee swings. */
export const PLAYER_ATTACK_COOLDOWN_S = 0.4;
/** Horizontal speed (blocks/s) imparted to a mob when hit, directed away from the attacker. */
export const MOB_KNOCKBACK_SPEED = 6;
/** Horizontal knockback multiplier for a melee hit landed while sprinting. MC parity: sprint-hits shove the target noticeably harder (spacing tool). Survival sprint requires hunger > SPRINT_MIN_HUNGER, so this only applies when actually sprinting. */
export const SPRINT_ATTACK_KNOCKBACK_SCALE = 1.6;
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
/** Sprint requires hunger strictly above this value (Survival). At or below it, sprint drops to a walk. MC parity: can't sprint at food level 6 or lower. */
export const SPRINT_MIN_HUNGER = 6;
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
/** Min seconds between successive block placements while right-click is held (~5 blocks/s). */
export const PLACE_INTERVAL_S = 0.2;

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
/** Hostiles only spawn on a block whose BLOCK-light level is at or below this (0–15). Torches raise nearby block-light above it, creating a spawn-proof safe zone. */
export const HOSTILE_SPAWN_MAX_LIGHT = 7;

// === Arrow projectile ===
/** Arrow flight speed (blocks/s). Straight-line, no gravity. Keep speed/60 < 2*(PLAYER_RADIUS+ARROW_HIT_RADIUS) (≈1.1) for reliable per-tick hit detection (at 22 b/s, per-tick travel ≈0.367 blocks). */
export const ARROW_SPEED = 22;
/** Damage (half-heart points) an arrow deals to the player on hit. */
export const ARROW_DAMAGE = 4;
/** Seconds an arrow lives before despawning if it hits nothing. */
export const ARROW_LIFETIME_S = 3;
/** Collision half-extent (blocks) added around the player AABB for the arrow point-hit test. */
export const ARROW_HIT_RADIUS = 0.25;

// === Player bow ===
/** Damage (half-heart points) a player-fired arrow deals to a mob on hit. */
export const BOW_DAMAGE = 5;
/** Minimum seconds between player bow shots. */
export const BOW_COOLDOWN_S = 0.5;
/** Point-vs-mob-center hit distance (blocks) for a player-fired arrow. */
export const BOW_ARROW_HIT_RADIUS = 0.6;
/** Forward offset from the player eye so the spawned arrow clears the player AABB. */
export const BOW_ARROW_SPAWN_OFFSET = 0.6;
/** Min arrows a skeleton drops on death (inclusive). */
export const SKELETON_ARROW_DROP_MIN = 1;
/** Max arrows a skeleton drops on death (inclusive). */
export const SKELETON_ARROW_DROP_MAX = 2;

// === Creeper (exploding hostile) ===
/** Max simultaneous live creepers at night (separate cap from zombies/skeletons). */
export const CREEPER_MAX_COUNT = 3;
/** Creeper health in half-heart points (dies in 2 player hits at PLAYER_ATTACK_DAMAGE=4). */
export const CREEPER_MAX_HEALTH = 8;
/** Horizontal distance (blocks) within which a creeper detects and chases the player. */
export const CREEPER_DETECT_RADIUS = 16;
/** Creeper horizontal chase speed (blocks/s). Keep speed/60 < radius(0.3) to avoid tunneling. */
export const CREEPER_MOVE_SPEED = 2.2;
/** Horizontal distance (blocks) at or below which the creeper lights its fuse and freezes in place. */
export const CREEPER_IGNITE_RANGE = 2.5;
/** Seconds the fuse burns before detonation once ignited. Resets if the player escapes IGNITE_RANGE. */
export const CREEPER_FUSE_S = 1.5;
/** Blast radius (blocks) for both the spherical terrain crater and the player-damage falloff. */
export const CREEPER_BLAST_RADIUS = 3;
/** Player damage (half-heart points) at the blast epicenter; falls off linearly to 0 at BLAST_RADIUS. */
export const CREEPER_BLAST_MAX_DAMAGE = 12;

// === Spider (fast melee hostile) ===
/** Max simultaneous live spiders at night (separate cap from zombies/skeletons/creepers). */
export const SPIDER_MAX_COUNT = 4;
/** Spider health in half-heart points (dies in 2 player hits at PLAYER_ATTACK_DAMAGE=4). */
export const SPIDER_MAX_HEALTH = 8;
/** Horizontal distance (blocks) within which a spider begins chasing the player. */
export const SPIDER_DETECT_RADIUS = 16;
/** Horizontal distance (blocks) at which a spider can bite the player. Slightly longer than a zombie's because the spider's body is wider. */
export const SPIDER_ATTACK_RANGE = 1.4;
/** Damage (half-heart points) per spider bite. Lower than a zombie (3): the spider trades power for speed. */
export const SPIDER_ATTACK_DAMAGE = 2;
/** Seconds between consecutive bites from the same spider. */
export const SPIDER_ATTACK_COOLDOWN_S = 1.0;
/** Spider horizontal chase speed (blocks/s) — its signature trait, faster than a zombie's 2.4. Keep speed/60 < radius(0.4) to avoid tunneling: 3.2/60 ≈ 0.053, safe. */
export const SPIDER_CHASE_SPEED = 3.2;

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

// === Weather (ambient precipitation) ===
/** Real-time seconds bounds for a CLEAR spell before precipitation may begin. */
export const WEATHER_CLEAR_MIN_S = 240;
export const WEATHER_CLEAR_MAX_S = 540;
/** Real-time seconds bounds for one precipitation spell. */
export const WEATHER_PRECIP_MIN_S = 30;
export const WEATHER_PRECIP_MAX_S = 75;
/** Randomized dry delay before the FIRST precipitation after a world loads, so a freshly-loaded world stays clear for a few minutes — rain is an occasional event, not the default. */
export const WEATHER_INITIAL_CLEAR_MIN_S = 150;
export const WEATHER_INITIAL_CLEAR_MAX_S = 360;
/** Seconds for precipitation intensity to ease fully in or out (0..1), so onset/end is gradual. */
export const WEATHER_FADE_S = 6;
/** Number of precipitation particles in the camera-following volume. Separate pool from block-break particles. */
export const WEATHER_PARTICLE_COUNT = 1200;
/** Half-extent (blocks) of the cubic precipitation volume centered on the camera. */
export const WEATHER_VOLUME_RADIUS = 14;
/** Camera Y at/above which precipitation falls as SNOW instead of RAIN (mirrors TerrainGenerator SNOW_LINE = 72). */
export const WEATHER_SNOW_MIN_Y = 72;

// === Sky bodies (visible sun + moon) ===
export const SKY_BODY_DISTANCE = 400; // world units from camera; < camera far (1000)
export const SUN_RADIUS = 30;         // half-width of the sun quad
export const MOON_RADIUS = 22;        // half-width of the moon quad

// === Clouds (drifting overhead layer) ===
/** World-Y of the flat cloud layer. Render-only and far above the 96-block terrain ceiling, so nothing ever intersects it. */
export const CLOUD_ALTITUDE = 160;
/** Half-width (world units) of the square cloud plane. It recenters on the camera each frame; fog dissolves the far edges. Kept so the plane corners (≈EXTENT·√2 horizontally + altitude) stay inside the 1000-unit camera far plane. */
export const CLOUD_EXTENT = 600;
/** Cloud drift speed in texture-UV units per second (slow, ~1 tile every few minutes). */
export const CLOUD_DRIFT_SPEED = 0.004;
/** How many times the cloud texture tiles across the plane (higher = smaller, denser cloud clusters). */
export const CLOUD_TEXTURE_REPEAT = 8;
/** Base opacity of the cloud layer at full daylight (eased down a little at night). */
export const CLOUD_OPACITY = 0.85;

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

// === Minimap (HUD top-down terrain overview) ===
/** Radius in blocks the minimap samples around the player; the sampled grid is (2R+1) cells square. */
export const MINIMAP_RADIUS_BLOCKS = 24;
/** On-screen edge length (px) of the square minimap canvas. */
export const MINIMAP_SIZE_PX = 132;
/** Seconds between terrain rescans — the expensive top-down column scan is throttled to this cadence. */
export const MINIMAP_REBUILD_INTERVAL_S = 0.3;

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
  FURNACE: 15,
  DIAMOND_ORE: 16,
  CHEST: 17,
  // Doors: 8 ids = facing(N/E/S/W) × open(closed/open). Upper/lower HALF is inferred by the
  // mesher from the below-neighbor (door below ⇒ upper half), not encoded here. Closed doors
  // are solid; open doors are non-solid but still raycast-targetable. Base (18) is even so the
  // open flag is the low bit: closed id ^ 1 === open id.
  DOOR_N_CLOSED: 18,
  DOOR_N_OPEN: 19,
  DOOR_E_CLOSED: 20,
  DOOR_E_OPEN: 21,
  DOOR_S_CLOSED: 22,
  DOOR_S_OPEN: 23,
  DOOR_W_CLOSED: 24,
  DOOR_W_OPEN: 25,
  TORCH: 26,
  GLOWSTONE: 27,
  BED: 28,
  LAVA: 29, // opaque non-solid hazard liquid; emits max block light, burns on contact
  CACTUS: 30, // desert plant; opaque solid cube, harvestable, burns on contact (survival)
  SANDSTONE: 31, // desert building block; opaque solid cube, crafted from 4 sand, generates beneath desert sand
  // Wall-torch orientation variants (ids 32..35): world-only — never held as items.
  // They normalise to BlockId.TORCH (id 26) when dropped. The lean direction is the
  // way the flame tips, matching the clicked face's outward normal.
  TORCH_WALL_NORTH: 32, // leans -Z (toward -Z); supporting wall is at +Z side
  TORCH_WALL_SOUTH: 33, // leans +Z; supporting wall is at -Z side
  TORCH_WALL_EAST: 34,  // leans +X; supporting wall is at -X side
  TORCH_WALL_WEST: 35,  // leans -X; supporting wall is at +X side
  // Surface vegetation: decorative cross-quad plants (rendered as two crossed vertical
  // DoubleSide quads, not cubes). Non-solid (no collision, walk-through), transparent
  // (don't occlude neighbor faces or light). Terrain-scattered on plains grass.
  TALL_GRASS: 36,
  FLOWER_RED: 37,
  FLOWER_YELLOW: 38,
} as const;
export type BlockId = typeof BlockId[keyof typeof BlockId];

// === Item IDs ===
// A non-block item id starts at 100. Block items are represented by their BlockId
// numeric value (0..38) directly, so a persisted block stack {block,count} reads
// back as {item,count} with item === block. Note: ids 32..35 are world-only block
// variants (wall-torch orientations) that are never held as items — they normalise
// to BlockId.TORCH on drop. ItemId is therefore the numeric union of "any BlockId"
// plus these non-block ids.
export const ItemId = {
  STICK: 100,
  WOODEN_PICKAXE: 101,
  WOODEN_AXE: 102,
  WOODEN_SHOVEL: 103,
  STONE_PICKAXE: 104,
  STONE_AXE: 105,
  STONE_SHOVEL: 106,
  IRON_PICKAXE: 107,
  IRON_AXE: 108,
  IRON_SHOVEL: 109,
  RAW_BEEF: 110,
  RAW_PORKCHOP: 111,
  RAW_CHICKEN: 112,
  RAW_MUTTON: 113,
  COOKED_BEEF: 114,
  COOKED_PORKCHOP: 115,
  COOKED_CHICKEN: 116,
  COOKED_MUTTON: 117,
  CHARCOAL: 118,        // smelted from logs; fuel equivalent to coal
  IRON_INGOT: 120,
  DIAMOND: 121,          // gem / crafting material
  DIAMOND_PICKAXE: 122,  // diamond-tier tools
  DIAMOND_AXE: 123,
  DIAMOND_SHOVEL: 124,
  WOODEN_SWORD: 130,
  STONE_SWORD: 131,
  IRON_SWORD: 132,
  DIAMOND_SWORD: 133,    // diamond-tier sword
  IRON_HELMET: 140,
  IRON_CHESTPLATE: 141,
  IRON_LEGGINGS: 142,
  IRON_BOOTS: 143,
  DIAMOND_HELMET: 144,      // diamond-tier armor
  DIAMOND_CHESTPLATE: 145,
  DIAMOND_LEGGINGS: 146,
  DIAMOND_BOOTS: 147,
  DOOR: 150,            // places a 2-tall oriented door; non-block item (renders via swatch+glyph)
  BOW: 151,             // ranged weapon; fires Arrow entities (handled in GameSession)
  ARROW: 152,           // ammo for the bow; also dropped by skeletons
} as const;
/** A BlockId value (0..38) OR one of the ItemId.* non-block ids (>=100). */
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
  /** Saturation points granted on eat (capped to the post-eat hunger level). Cooked food >> raw. */
  saturationRestore: number;
}

/** Weapon behavior: the melee attack damage (half-heart points) dealt when this item is held. */
export interface WeaponDef {
  /** Absolute melee damage in half-heart points; replaces the base fist damage (PLAYER_ATTACK_DAMAGE) while held. */
  damage: number;
}

// === Armor ===
/** Equippable armor body slots. Numeric so equipped armor is a length-ARMOR_SLOT_COUNT array indexed by slot. */
export const ArmorSlot = {
  HEAD: 0,
  CHEST: 1,
  LEGS: 2,
  FEET: 3,
} as const;
export type ArmorSlot = typeof ArmorSlot[keyof typeof ArmorSlot];
/** Number of equippable armor slots (head/chest/legs/feet). */
export const ARMOR_SLOT_COUNT = 4;
/** Fraction of incoming (non-bypassing) damage absorbed per armor point. */
export const ARMOR_POINT_REDUCTION = 0.04;
/** Hard cap on total armor damage reduction (classic Minecraft 80%). */
export const ARMOR_MAX_REDUCTION = 0.8;
/** Armor-point scale the HUD armor bar fills against (10 icons x 2 points). */
export const ARMOR_DISPLAY_MAX = 20;

/** Armor behavior: which body slot it occupies and its defense value in armor points. */
export interface ArmorDef {
  slot: ArmorSlot;
  /** Armor points. Each point reduces incoming damage by ARMOR_POINT_REDUCTION, capped at ARMOR_MAX_REDUCTION total. */
  defense: number;
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
  /** Weapon behavior if this item is a melee weapon, else null. */
  weapon: WeaponDef | null;
  /** Armor behavior if this item is wearable, else null. */
  armor: ArmorDef | null;
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
  /** Block-light emission level 0..15. Omitted (never undefined) for non-emitters. */
  light?: number;
  /** PBR surface roughness 0..1 for the P3 MeshStandard chunk material. Omitted (never undefined) → mesher/material use the default (~0.85, matte). */
  roughness?: number;
  /** Strength of the normal-map bevel/detail for this block, 0..1. Omitted → material default. */
  normalStrength?: number;
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

// === Smelting / furnace ===
/** Real-time seconds to smelt one item in a furnace at the base rate. */
export const SMELT_DURATION_S = 10;

/** A furnace smelting recipe: one input item smelts into one output item (always count 1). */
export interface SmeltingRecipe {
  input: ItemId;
  output: ItemId;
}

/** Fuel behavior. burnValue = how many items this fuel can smelt (Minecraft-style; coal=8). Seconds of burn = burnValue * SMELT_DURATION_S. */
export interface FuelDef {
  burnValue: number;
}

/**
 * Live state of one furnace at a world position. Plain & JSON-serializable so it can be
 * persisted per-world. All three stacks are null when that slot is empty.
 */
export interface FurnaceState {
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  /** Seconds of fuel burn remaining; >0 means actively lit. */
  burnTimeRemaining: number;
  /** Seconds the current lit fuel unit started with, for the flame-gauge ratio. 0 when not lit. */
  burnTimeTotal: number;
  /** Seconds of cooking accumulated toward SMELT_DURATION_S for the current input. */
  cookProgress: number;
}

/** Number of storage slots in a chest. */
export const CHEST_SLOTS = 27;

/** Integer WORLD coords of a loot chest placed by structure generation (e.g. a dungeon chest). Recorded on Chunk.lootChests at generation time and drained by GameSession to seed deterministic loot exactly once. */
export interface LootChestSite {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Live state of one chest at a world position. Plain & JSON-serializable so it can be
 * persisted per-world. Each element is null when that slot is empty.
 * `slots` is always length CHEST_SLOTS.
 */
export interface ChestState {
  slots: (ItemStack | null)[];
}

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
  /**
   * Normalized daylight factor in [0, 1]: 0 = deep night, 1 = full midday. Drives the terrain
   * lighting shader's sky-light dimming (a uniform). Weather may multiply this down toward 0
   * during precipitation. Independent of ambientIntensity (which lights entities via the scene).
   */
  daylight: number;
  /** Unit vector: the direction sunlight TRAVELS (from the sun toward the scene). The directional light is positioned on the opposite side (at -sunDirection * distance). */
  readonly sunDirection: THREE.Vector3;
}

/** Ambient weather state. 'clear' = no precipitation; 'rain'/'snow' = precipitating (snow at high altitude). */
export type WeatherKind = 'clear' | 'rain' | 'snow';

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
  /** Sky-light level 0..15 at world coords. Returns 0 for unloaded chunks / out of vertical range. */
  getSkyLight(x: number, y: number, z: number): number;
  /** Block-light (emitter) level 0..15 at world coords. Returns 0 for unloaded chunks / out of vertical range. */
  getBlockLight(x: number, y: number, z: number): number;
  /** Combined light level: max(sky, block) at world coords. Returns 0 for unloaded chunks / out of vertical range. */
  getLight(x: number, y: number, z: number): number;
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

/**
 * Narrow world-space accessor the LightEngine uses for cross-chunk sky-light
 * propagation. World implements this. Coordinates are world (not chunk-local).
 */
export interface ISkyLightAccess {
  /** Block id at world coords; unloaded chunk / out of range => BlockId.AIR. */
  getBlock(x: number, y: number, z: number): BlockId;
  /** Sky-light 0..15 at world coords; unloaded / out of range => 0. */
  getSkyLight(x: number, y: number, z: number): number;
  /** Write sky-light 0..15 at world coords; no-op if the chunk isn't loaded. */
  setSkyLight(x: number, y: number, z: number, level: number): void;
  /** True iff the chunk containing these world coords is currently loaded. */
  isChunkLoaded(x: number, y: number, z: number): boolean;
  /** Block-light 0..15 at world coords; unloaded / out of range => 0. Used by block-light BFS boundary injection. */
  getBlockLight(x: number, y: number, z: number): number;
}

// === Block registry helper (world implements; others read) ===
export interface IBlockRegistry {
  get(id: BlockId): BlockDef;
  isSolid(id: BlockId): boolean;
  isTransparent(id: BlockId): boolean;
  /** Block-light emission 0..15 for the given block; returns 0 for non-emitters. */
  getLightEmission(id: BlockId): number;
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
  /** Hidden saturation buffer in [0, hunger]; drains before hunger and enables fast regen. Not persisted; resets each load. */
  saturation: number;
  /** Equipped armor by ArmorSlot index; null = empty. Length ARMOR_SLOT_COUNT. Persisted (survival only). */
  armor: (ItemId | null)[];
}

// === Texture atlas: returns UV rect for a given tile index ===
export interface ITextureAtlas {
  /** UV rect in atlas: [u0, v0, u1, v1]. Origin bottom-left, range [0,1]. */
  getUV(tileIndex: number): [number, number, number, number];
  /** The atlas Three.js texture, ready to assign to a material. */
  readonly texture: THREE.Texture;
  /** Tile dimensions for shader use. */
  readonly tileCount: number;
  /** Current atlas geometry (tile size, grid, gutter) — the worker's UV source of truth. */
  getAtlasParams(): WorkerAtlasParams;
  /** Companion tangent-space normal map, same tile grid + gutter as `texture`. P3+. */
  readonly normalTexture: THREE.Texture;
  /** Companion roughness/AO map (roughness in G), same tile grid + gutter as `texture`. P3+. */
  readonly roughnessTexture: THREE.Texture;
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

// === Keybindings ===
/** Actions whose key can be remapped in Settings. Escape + hotbar digits stay fixed. */
export type KeyBindableAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'inventory';

/** Maps each bindable action to a physical KeyboardEvent.code (e.g. 'KeyW', 'Space', 'ShiftLeft'). */
export type Keybindings = Record<KeyBindableAction, string>;

/** Stable iteration order for the Settings UI rows. */
export const KEYBINDABLE_ACTIONS: readonly KeyBindableAction[] = [
  'forward',
  'back',
  'left',
  'right',
  'jump',
  'sprint',
  'inventory',
];

export const DEFAULT_KEYBINDINGS: Readonly<Keybindings> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  inventory: 'KeyE',
};

// === Graphics quality enums (P0 scaffolding) ===
export const GraphicsQuality = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  ULTRA: 'ultra',
  CUSTOM: 'custom',
} as const;
export type GraphicsQuality = typeof GraphicsQuality[keyof typeof GraphicsQuality];

export const AntiAlias = {
  OFF: 'off',
  FXAA: 'fxaa',
  SMAA: 'smaa',
} as const;
export type AntiAlias = typeof AntiAlias[keyof typeof AntiAlias];

export const WaterQuality = {
  BASIC: 'basic',
  ANIMATED: 'animated',
  REFLECTIVE: 'reflective',
} as const;
export type WaterQuality = typeof WaterQuality[keyof typeof WaterQuality];

export const EdgeRounding = {
  OFF: 'off',
  ANALYTIC: 'analytic',
  NORMALMAP: 'normalmap',
} as const;
export type EdgeRounding = typeof EdgeRounding[keyof typeof EdgeRounding];

export const ShadowSoftness = {
  PCF: 'pcf',
  PCF_SOFT: 'pcfsoft',
} as const;
export type ShadowSoftness = typeof ShadowSoftness[keyof typeof ShadowSoftness];

export const ToneMapping = {
  NONE: 'none',
  LINEAR: 'linear',
  ACES: 'aces',
} as const;
export type ToneMapping = typeof ToneMapping[keyof typeof ToneMapping];

export const FogType = {
  LINEAR: 'linear',
  EXP2: 'exp2',
} as const;
export type FogType = typeof FogType[keyof typeof FogType];

export const CloudDetail = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  ULTRA: 'ultra',
} as const;
export type CloudDetail = typeof CloudDetail[keyof typeof CloudDetail];

/** Shadow map resolution options. 0 = shadows disabled. */
export const SHADOW_MAP_SIZES = [0, 512, 1024, 2048] as const;
/** SSAO kernel sample counts. */
export const SSAO_SAMPLE_COUNTS = [8, 16, 32] as const;
/** Texture atlas tile sizes in pixels. */
export const ATLAS_TILE_SIZES = [16, 32, 64] as const;
/** Anisotropic filtering levels. 0 = max sentinel (resolve to renderer.capabilities.getMaxAnisotropy() at apply time). */
export const ANISOTROPY_LEVELS = [1, 4, 8, 0] as const;

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
  keybindings: Keybindings;
  // === Graphics (P0 scaffolding; consumed in later phases) ===
  graphicsQuality?: GraphicsQuality;
  pixelRatioCap?: number;
  antiAlias?: AntiAlias;
  shadowMapSize?: number;
  shadowSoftness?: ShadowSoftness;
  ssao?: boolean;
  ssaoIntensity?: number;
  ssaoSamples?: number;
  normalMaps?: boolean;
  edgeRounding?: EdgeRounding;
  atlasTileSize?: number;
  anisotropy?: number;
  toneMapping?: ToneMapping;
  fogType?: FogType;
  bloom?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  waterQuality?: WaterQuality;
  cloudDetail?: CloudDetail;
}

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: RENDER_DISTANCE,
  fov: 75,
  mouseSensitivity: 1.0,
  masterVolume: 1.0,
  musicVolume: 0,
  sfxVolume: 1.0,
  invertY: false,
  showFps: true,
  keybindings: { ...DEFAULT_KEYBINDINGS },
  graphicsQuality: GraphicsQuality.MEDIUM,
  pixelRatioCap: 1.5,
  antiAlias: AntiAlias.FXAA,
  shadowMapSize: 1024,
  shadowSoftness: ShadowSoftness.PCF_SOFT,
  ssao: false,
  ssaoIntensity: 0.8,
  ssaoSamples: 16,
  normalMaps: false,
  edgeRounding: EdgeRounding.ANALYTIC,
  atlasTileSize: 16,
  anisotropy: 4,
  toneMapping: ToneMapping.NONE,
  fogType: FogType.LINEAR,
  bloom: false,
  bloomIntensity: 0.4,
  bloomThreshold: 0.85,
  waterQuality: WaterQuality.BASIC,
  cloudDetail: CloudDetail.MEDIUM,
};

export const SETTINGS_RANGES = {
  renderDistance: { min: 2, max: 16, step: 1 },
  fov: { min: 60, max: 110, step: 1 },
  mouseSensitivity: { min: 0.25, max: 3.0, step: 0.05 },
  masterVolume: { min: 0, max: 1, step: 0.05 },
  musicVolume: { min: 0, max: 1, step: 0.05 },
  sfxVolume: { min: 0, max: 1, step: 0.05 },
  pixelRatioCap: { min: 0.5, max: 3.0, step: 0.25 },
  ssaoIntensity: { min: 0.1, max: 2.0, step: 0.1 },
  bloomIntensity: { min: 0.0, max: 1.5, step: 0.05 },
  bloomThreshold: { min: 0.5, max: 1.0, step: 0.05 },
} as const;

/** The granular knob values a quality preset writes. (ssaoIntensity + bloomThreshold are NOT preset-controlled — they keep their current value when a preset is chosen.) */
export type GraphicsPreset = Pick<Required<Settings>,
  'pixelRatioCap' | 'antiAlias' | 'shadowMapSize' | 'shadowSoftness' | 'ssao' | 'ssaoSamples'
  | 'normalMaps' | 'edgeRounding' | 'atlasTileSize' | 'anisotropy' | 'toneMapping' | 'fogType'
  | 'bloom' | 'bloomIntensity' | 'waterQuality' | 'cloudDetail'>;

/** Selecting a quality preset writes ALL these knob values (Implementation Brief B3). 'custom' has no preset entry — it just means "user-edited". */
export const GRAPHICS_PRESETS: Record<Exclude<GraphicsQuality, 'custom'>, GraphicsPreset> = {
  low:    { pixelRatioCap: 1.0, antiAlias: AntiAlias.OFF,  shadowMapSize: 0,    shadowSoftness: ShadowSoftness.PCF,      ssao: false, ssaoSamples: 8,  normalMaps: false, edgeRounding: EdgeRounding.OFF,       atlasTileSize: 16, anisotropy: 1, toneMapping: ToneMapping.NONE,   fogType: FogType.LINEAR, bloom: false, bloomIntensity: 0.0, waterQuality: WaterQuality.BASIC,      cloudDetail: CloudDetail.LOW },
  medium: { pixelRatioCap: 1.5, antiAlias: AntiAlias.FXAA, shadowMapSize: 512,  shadowSoftness: ShadowSoftness.PCF,      ssao: false, ssaoSamples: 8,  normalMaps: false, edgeRounding: EdgeRounding.ANALYTIC,  atlasTileSize: 16, anisotropy: 4, toneMapping: ToneMapping.LINEAR, fogType: FogType.LINEAR, bloom: false, bloomIntensity: 0.0, waterQuality: WaterQuality.BASIC,      cloudDetail: CloudDetail.MEDIUM },
  high:   { pixelRatioCap: 2.0, antiAlias: AntiAlias.SMAA, shadowMapSize: 1024, shadowSoftness: ShadowSoftness.PCF_SOFT, ssao: false, ssaoSamples: 8,  normalMaps: true,  edgeRounding: EdgeRounding.NORMALMAP, atlasTileSize: 32, anisotropy: 8, toneMapping: ToneMapping.ACES,   fogType: FogType.EXP2,   bloom: true,  bloomIntensity: 0.4, waterQuality: WaterQuality.ANIMATED,   cloudDetail: CloudDetail.HIGH },
  ultra:  { pixelRatioCap: 3.0, antiAlias: AntiAlias.SMAA, shadowMapSize: 2048, shadowSoftness: ShadowSoftness.PCF_SOFT, ssao: false, ssaoSamples: 16, normalMaps: true,  edgeRounding: EdgeRounding.NORMALMAP, atlasTileSize: 64, anisotropy: 0, toneMapping: ToneMapping.ACES,   fogType: FogType.EXP2,   bloom: true,  bloomIntensity: 0.6, waterQuality: WaterQuality.REFLECTIVE, cloudDetail: CloudDetail.ULTRA },
};

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
  /** Respawn anchor set by sleeping in a bed (FEET position on top of the bed). Absent until the player first sleeps. */
  spawnPoint?: Vec3;
  /** Persisted inventory: INVENTORY_SIZE slots, null = empty. Slots are {item,count}; legacy saves used {block,count} (numerically identical for block items, so readable by reading item ?? block). Absent on Creative worlds. */
  inventory?: (ItemStack | null)[];
  /** Persisted equipped armor: ARMOR_SLOT_COUNT slots, null = empty. Absent on Creative / legacy saves. */
  armor?: (ItemId | null)[];
}

/** Sparse map of player edits per chunk. Key format: `${cx},${cz}`; value is array of [linearIndex, BlockId] tuples. */
export type ChunkOverrides = Record<string, [number, BlockId][]>;

export interface WorldSave {
  metadata: WorldMetadata;
  overrides: ChunkOverrides;
}

// === World import/export ===
/** Magic string identifying a Blockraft world-export file. */
export const WORLD_EXPORT_FORMAT = 'blockraft-world';
/** Current export schema version. Bump when the envelope shape changes incompatibly. */
export const WORLD_EXPORT_VERSION = 1;

/**
 * Self-contained, JSON-serializable snapshot of one world: metadata + block overrides +
 * furnace states + chest states + seeded-loot markers. This is the on-disk format produced by Export and consumed by Import.
 * `furnaces` and `chests` are keyed by world-position string (e.g. "12,64,-3"), matching WorldStorage.
 */
export interface WorldExport {
  format: typeof WORLD_EXPORT_FORMAT;
  version: number;
  metadata: WorldMetadata;
  overrides: ChunkOverrides;
  furnaces: Record<string, FurnaceState>;
  chests?: Record<string, ChestState>;
  /** Position keys ("x,y,z") of loot chests whose loot has already been seeded, so import preserves the looted/unlooted state and chests don't refill. Absent on v1 export files. */
  seededLootChests?: string[];
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
  CREEPER: 'creeper',
  SPIDER: 'spider',
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

// ===== Async chunk meshing (Web Worker) contract =====
// The heavy ChunkMesher loop runs off-thread. The main thread builds a padded
// "halo" block array for a chunk, posts it to the worker, and the worker returns
// typed-array geometry buffers that the main thread uploads to the GPU.

/**
 * Compact, serializable block metadata the worker needs (the worker has no
 * BlockRegistry / DOM / THREE). Built once on the main thread from BlockRegistry
 * and posted to the worker at init. Index = BlockId numeric value; arrays are
 * sized to (max BlockId + 1). Parallel arrays for tight postMessage payload.
 */
export interface WorkerBlockTable {
  transparent: Uint8Array;  // transparent[id] = 1 if transparent, else 0
  texTop: Uint8Array;       // atlas tile index for the top face
  texBottom: Uint8Array;    // atlas tile index for the bottom face
  texSide: Uint8Array;      // atlas tile index for side faces
}

/**
 * Atlas geometry so the worker can compute tile UVs without a canvas.
 *
 * Tiles sit on an `atlasCols` × `atlasRows` grid. Each tile occupies a square
 * cell of side `cellPitch = tilePixels + 2 * gutterPixels`; the drawn content is
 * inset by `gutterPixels` inside its cell, and the gutter holds edge-extruded
 * "bleed" so trilinear/mip sampling never crosses a tile boundary. The atlas
 * canvas is square: `atlasSize = atlasCols * cellPitch` (atlasCols === atlasRows
 * today, so the same denominator works for both U and V). At `gutterPixels === 0`
 * the layout collapses to the classic tight grid (`atlasSize = atlasCols * tilePixels`).
 */
export interface WorkerAtlasParams {
  tilePixels: number;   // drawn tile size in px: 16 | 32 | 64
  atlasCols: number;    // grid columns (6)
  atlasRows: number;    // grid rows (6)
  atlasSize: number;    // full SQUARE canvas dimension = atlasCols * cellPitch
  gutterPixels: number; // padding around each tile's content (0 at 16px; >0 at 32/64)
}

/** One-time init message: main thread -> worker. */
export interface WorkerInitMsg {
  type: 'init';
  blockTable: WorkerBlockTable;
  atlasParams: WorkerAtlasParams;
}

/**
 * Per-chunk mesh job: main thread -> worker.
 *
 * `halo` is a padded copy of the chunk's blocks with a 1-block horizontal border
 * holding neighbour blocks (INCLUDING the four diagonal corners — required for
 * correct ambient-occlusion corner sampling on top/bottom faces). There is NO
 * vertical padding: Y out-of-range is handled by the worker (below 0 = opaque so
 * the world floor face is culled; at/above CHUNK_HEIGHT = air).
 *
 * Dimensions: HALO = CHUNK_SIZE + 2 (=18) in X and Z, CHUNK_HEIGHT (=96) in Y.
 * Length = HALO * CHUNK_HEIGHT * HALO.
 * Index of halo cell (hx, y, hz): hx + hz*HALO + y*HALO*HALO, hx,hz in [0, HALO).
 * The chunk interior block (lx,ly,lz) lives at halo cell (lx+1, ly, lz+1).
 * Border cells outside any loaded chunk are BlockId.AIR (0).
 *
 * `version` is the chunk's dirty-version at the moment the job was enqueued; the
 * main thread discards a result whose version no longer matches the live chunk
 * (or whose chunk was unloaded) to avoid applying a stale mesh.
 */
export interface ChunkMeshRequest {
  type: 'mesh_request';
  cx: number;
  cz: number;
  version: number;
  halo: Uint8Array;
  /** Parallel SKY-light halo: same 18×18×96 shape & indexing as `halo`; each element is the sky-light level (0..15). Transferred zero-copy. */
  skyLightHalo: Uint8Array;
  /** Parallel BLOCK-light (emitter) halo: same shape/indexing; each element is the block-light level (0..15). Transferred zero-copy. */
  blockLightHalo: Uint8Array;
  /** When true the worker also emits a `tangents` buffer (4 floats/vertex) for normal mapping. False on Low/Medium to save work. */
  includeTangents: boolean;
}

/** Geometry buffers for one mesh. All arrays are typed and Transferable. */
export interface MeshBuffers {
  positions: Float32Array; // vertexCount * 3
  normals: Float32Array;   // vertexCount * 3
  uvs: Float32Array;       // vertexCount * 2
  colors: Float32Array;    // vertexCount * 3
  indices: Uint32Array;    // faceCount * 6 (two triangles per quad)
  tangents?: Float32Array; // vertexCount * 4 (xyz + handedness w = ±1); present only when includeTangents was true
}

/** Per-chunk mesh result: worker -> main thread. `water` is null if no water faces. */
export interface ChunkMeshResult {
  type: 'mesh_result';
  cx: number;
  cz: number;
  version: number;
  solid: MeshBuffers;
  water: MeshBuffers | null;
}

/** Max concurrent in-flight worker jobs. */
export const MESH_WORKER_CONCURRENCY = 4;

/** Max mesh results uploaded to the GPU per frame (caps upload hitching). */
export const MESH_UPLOAD_PER_FRAME = 4;
