import { CHEST_SLOTS, type ChestState, type ItemStack } from '../types';

export class ChestManager {
  private readonly _states: Map<string, ChestState> = new Map();

  constructor(initial?: Record<string, ChestState>) {
    if (initial !== undefined) {
      this.deserialize(initial);
    }
  }

  private static _key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private static _emptyState(): ChestState {
    return { slots: new Array<ItemStack | null>(CHEST_SLOTS).fill(null) };
  }

  /** Return existing state, or create a fresh empty one on first access. */
  getOrRegister(x: number, y: number, z: number): ChestState {
    const key = ChestManager._key(x, y, z);
    const existing = this._states.get(key);
    if (existing !== undefined) return existing;
    const fresh = ChestManager._emptyState();
    this._states.set(key, fresh);
    return fresh;
  }

  /**
   * Remove the chest at (x,y,z) and return any items it held as drops.
   * Returns an empty array if no state was registered.
   */
  unregister(x: number, y: number, z: number): ItemStack[] {
    const key = ChestManager._key(x, y, z);
    const st = this._states.get(key);
    this._states.delete(key);
    if (st === undefined) return [];
    const drops: ItemStack[] = [];
    for (const slot of st.slots) {
      if (slot !== null) drops.push(slot);
    }
    return drops;
  }

  /**
   * Serialize all non-empty chests to a plain record for persistence.
   * Chests with every slot null are skipped to avoid persisting junk.
   */
  serialize(): Record<string, ChestState> {
    const out: Record<string, ChestState> = {};
    for (const [key, st] of this._states) {
      const empty = st.slots.every((s) => s === null);
      if (!empty) {
        out[key] = st;
      }
    }
    return out;
  }

  /** Replace all states from a previously serialized record. */
  deserialize(record: Record<string, ChestState>): void {
    this._states.clear();
    for (const k of Object.keys(record)) {
      const st = record[k];
      if (st !== undefined) {
        this._states.set(k, st);
      }
    }
  }

  /** Remove all registered states. */
  clear(): void {
    this._states.clear();
  }
}
