import { SMELT_DURATION_S, type FurnaceState, type ItemStack, type ItemId } from '../types';
import { itemMaxStack } from '../items/ItemRegistry';
import { getSmeltingRecipe, getFuelDef } from '../crafting/Smelting';

// === Module-local helpers ===

function outputHasRoom(output: ItemStack | null, outItem: ItemId): boolean {
  return output === null || (output.item === outItem && output.count < itemMaxStack(outItem));
}

function consumeOne(stack: ItemStack): ItemStack | null {
  return stack.count > 1 ? { item: stack.item, count: stack.count - 1 } : null;
}

function produceInto(output: ItemStack | null, item: ItemId): ItemStack {
  return output === null ? { item, count: 1 } : { item: output.item, count: output.count + 1 };
}

// === FurnaceManager ===

export class FurnaceManager {
  private readonly _states: Map<string, FurnaceState> = new Map();

  constructor(initial?: Record<string, FurnaceState>) {
    if (initial !== undefined) {
      this.deserialize(initial);
    }
  }

  private static _key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private static _emptyState(): FurnaceState {
    return {
      input: null,
      fuel: null,
      output: null,
      burnTimeRemaining: 0,
      burnTimeTotal: 0,
      cookProgress: 0,
    };
  }

  /** Return existing state, or create a fresh empty one on first access. */
  getOrRegister(x: number, y: number, z: number): FurnaceState {
    const key = FurnaceManager._key(x, y, z);
    const existing = this._states.get(key);
    if (existing !== undefined) return existing;
    const fresh = FurnaceManager._emptyState();
    this._states.set(key, fresh);
    return fresh;
  }

  /**
   * Remove the furnace at (x,y,z) and return any items it held as drops.
   * Returns an empty array if no state was registered.
   */
  unregister(x: number, y: number, z: number): ItemStack[] {
    const key = FurnaceManager._key(x, y, z);
    const st = this._states.get(key);
    this._states.delete(key);
    if (st === undefined) return [];
    const drops: ItemStack[] = [];
    if (st.input !== null)  drops.push(st.input);
    if (st.fuel !== null)   drops.push(st.fuel);
    if (st.output !== null) drops.push(st.output);
    return drops;
  }

  /** Advance all furnace states by dt seconds. */
  update(dt: number): void {
    for (const st of this._states.values()) {
      this._tick(st, dt);
    }
  }

  /**
   * Serialize all non-idle states to a plain record for persistence.
   * Fully idle-empty states are skipped to avoid persisting junk.
   */
  serialize(): Record<string, FurnaceState> {
    const out: Record<string, FurnaceState> = {};
    for (const [key, st] of this._states) {
      const idle =
        st.input === null &&
        st.fuel === null &&
        st.output === null &&
        st.burnTimeRemaining <= 0 &&
        st.cookProgress <= 0;
      if (!idle) {
        out[key] = st;
      }
    }
    return out;
  }

  /** Replace all states from a previously serialized record. */
  deserialize(record: Record<string, FurnaceState>): void {
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

  // === Private smelting tick ===

  private _tick(st: FurnaceState, dt: number): void {
    const recipe = st.input !== null ? getSmeltingRecipe(st.input.item) : null;
    const smelting = recipe !== null && outputHasRoom(st.output, recipe.output);

    // Light a fresh fuel unit if dark, there's something to smelt, and fuel is present.
    if (st.burnTimeRemaining <= 0 && smelting && st.fuel !== null) {
      const fd = getFuelDef(st.fuel.item);
      if (fd !== null) {
        st.burnTimeTotal = fd.burnValue * SMELT_DURATION_S;
        st.burnTimeRemaining = st.burnTimeTotal;
        st.fuel = consumeOne(st.fuel);
      }
    }

    // Burn down.
    if (st.burnTimeRemaining > 0) {
      st.burnTimeRemaining = Math.max(0, st.burnTimeRemaining - dt);
      if (st.burnTimeRemaining <= 0) st.burnTimeTotal = 0;
    }

    // Cook only while lit AND there's a valid smelt with output room.
    if (smelting && st.burnTimeRemaining > 0) {
      st.cookProgress += dt;
      if (st.cookProgress >= SMELT_DURATION_S) {
        st.cookProgress -= SMELT_DURATION_S;
        // recipe is non-null (smelting guard). st.input is non-null (recipe was found from it).
        // Re-check with explicit guards so the compiler is satisfied without ! assertions.
        if (recipe !== null && st.input !== null) {
          st.output = produceInto(st.output, recipe.output);
          st.input = consumeOne(st.input);
        }
      }
    } else if (!smelting) {
      // Input changed/removed or output full -> lose progress (MC behavior).
      st.cookProgress = 0;
    }
    // else (smelting but unlit): cookProgress frozen, resumes when refueled.
  }
}
