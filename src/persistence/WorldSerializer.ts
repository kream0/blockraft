import {
  WORLD_EXPORT_FORMAT,
  WORLD_EXPORT_VERSION,
  type WorldExport,
  type WorldSave,
  type WorldMetadata,
  type ChunkOverrides,
  type FurnaceState,
  type ItemStack,
  type Vec3,
  type BlockId,
  GameMode,
  INVENTORY_SIZE,
} from '../types';

/** Build the export envelope and JSON-stringify it (pretty-printed with 2-space indent). */
export function serializeWorld(save: WorldSave, furnaces: Record<string, FurnaceState>): string {
  const envelope: WorldExport = {
    format: WORLD_EXPORT_FORMAT,
    version: WORLD_EXPORT_VERSION,
    metadata: save.metadata,
    overrides: save.overrides,
    furnaces,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Accept `item` (current) or `block` (legacy field name — numerically identical for block items).
 * Normalises output to always use `item`.
 */
function toStack(v: unknown): ItemStack | null {
  if (v === null || typeof v !== 'object') return null;
  const obj = v as Record<string, unknown>;

  let id: number;
  if (typeof obj['item'] === 'number' && Number.isInteger(obj['item']) && obj['item'] > 0) {
    id = obj['item'];
  } else if (typeof obj['block'] === 'number' && Number.isInteger(obj['block']) && obj['block'] > 0) {
    id = obj['block'];
  } else {
    return null;
  }

  if (typeof obj['count'] !== 'number' || !Number.isFinite(obj['count'])) return null;
  const count = Math.floor(obj['count']);
  if (count < 1) return null;

  return { item: id, count };
}

function toFinite(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function toVec3(v: unknown): Vec3 {
  const zero: Vec3 = { x: 0, y: 0, z: 0 };
  if (v === null || typeof v !== 'object') return zero;
  const obj = v as Record<string, unknown>;
  const x = typeof obj['x'] === 'number' && Number.isFinite(obj['x']) ? obj['x'] : null;
  const y = typeof obj['y'] === 'number' && Number.isFinite(obj['y']) ? obj['y'] : null;
  const z = typeof obj['z'] === 'number' && Number.isFinite(obj['z']) ? obj['z'] : null;
  if (x === null || y === null || z === null) return zero;
  return { x, y, z };
}

function toOverrides(raw: unknown): ChunkOverrides {
  const result: ChunkOverrides = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return result;
  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    // Chunk coordinate key must be "cx,cz" with optional negative integers.
    if (!/^-?\d+,-?\d+$/.test(key)) continue;
    const arr = obj[key];
    if (!Array.isArray(arr)) continue;

    const tuples: [number, BlockId][] = [];
    for (const el of arr) {
      if (!Array.isArray(el) || el.length !== 2) continue;
      const idx = el[0];
      const bid = el[1];
      if (
        typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 &&
        typeof bid === 'number' && Number.isInteger(bid) && bid >= 0
      ) {
        // bid is validated as a non-negative integer; cast to BlockId (trusted boundary).
        tuples.push([idx, bid as BlockId]);
      }
    }

    if (tuples.length > 0) {
      result[key] = tuples;
    }
  }

  return result;
}

function toFurnaces(raw: unknown): Record<string, FurnaceState> {
  const result: Record<string, FurnaceState> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return result;
  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    // Furnace key is "x,y,z" with optional negative integers.
    if (!/^-?\d+,-?\d+,-?\d+$/.test(key)) continue;
    const val = obj[key];
    if (val === null || typeof val !== 'object' || Array.isArray(val)) continue;
    const fs = val as Record<string, unknown>;

    const state: FurnaceState = {
      input: toStack(fs['input']),
      fuel: toStack(fs['fuel']),
      output: toStack(fs['output']),
      burnTimeRemaining: Math.max(0, toFinite(fs['burnTimeRemaining'], 0)),
      burnTimeTotal: Math.max(0, toFinite(fs['burnTimeTotal'], 0)),
      cookProgress: Math.max(0, toFinite(fs['cookProgress'], 0)),
    };

    result[key] = state;
  }

  return result;
}

/**
 * Untrusted-file boundary. Parse an already-JSON.parsed value into a clean WorldExport,
 * or return null if it is not a recoverable Blockraft world file. NEVER throws.
 */
export function validateWorldExport(input: unknown): WorldExport | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  const obj = input as Record<string, unknown>;

  // Hard requirements: format and version must be exact.
  if (obj['format'] !== WORLD_EXPORT_FORMAT) return null;
  // Only the current schema version is understood (no migration path yet — when the
  // envelope shape changes incompatibly, bump WORLD_EXPORT_VERSION and migrate here).
  if (obj['version'] !== WORLD_EXPORT_VERSION) return null;

  // Validate metadata.
  const rawMeta = obj['metadata'];
  if (rawMeta === null || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) return null;
  const m = rawMeta as Record<string, unknown>;

  // Required fields: reject whole import if invalid.
  const name = typeof m['name'] === 'string' && m['name'].length > 0 ? m['name'] : null;
  if (name === null) return null;

  const seed = typeof m['seed'] === 'number' && Number.isFinite(m['seed']) ? m['seed'] : null;
  if (seed === null) return null;

  const rawGameMode = m['gameMode'];
  const gameMode: GameMode | null =
    rawGameMode === GameMode.SURVIVAL ? GameMode.SURVIVAL :
    rawGameMode === GameMode.CREATIVE ? GameMode.CREATIVE :
    null;
  if (gameMode === null) return null;

  // Recoverable fields: fall back on invalid.
  const createdAt = toFinite(m['createdAt'], Date.now());
  const lastPlayed = toFinite(m['lastPlayed'], Date.now());
  const playerPosition = toVec3(m['playerPosition']);
  const playerYaw = toFinite(m['playerYaw'], 0);
  const playerPitch = toFinite(m['playerPitch'], 0);

  const rawSlot = m['selectedSlot'];
  const selectedSlot =
    typeof rawSlot === 'number' && Number.isFinite(rawSlot)
      ? Math.min(8, Math.max(0, Math.floor(rawSlot)))
      : 0;

  // Optional inventory: include only when present and an array; never set to undefined.
  let inventoryResult: (ItemStack | null)[] | null = null;
  if (Array.isArray(m['inventory'])) {
    const arr = m['inventory'] as unknown[];
    // Map to INVENTORY_SIZE slots, filling missing slots with null.
    const mapped: (ItemStack | null)[] = [];
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      mapped.push(i < arr.length ? toStack(arr[i]) : null);
    }
    inventoryResult = mapped;
  }

  const metadata: WorldMetadata = {
    name,
    seed,
    createdAt,
    lastPlayed,
    gameMode,
    playerPosition,
    playerYaw,
    playerPitch,
    selectedSlot,
    // exactOptionalPropertyTypes: spread conditionally rather than assigning undefined.
    ...(inventoryResult !== null ? { inventory: inventoryResult } : {}),
  };

  const overrides = toOverrides(obj['overrides']);
  const furnaces = toFurnaces(obj['furnaces']);

  return {
    format: WORLD_EXPORT_FORMAT,
    version: WORLD_EXPORT_VERSION,
    metadata,
    overrides,
    furnaces,
  };
}
