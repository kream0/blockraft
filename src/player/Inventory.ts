import { BlockId, ItemStack, MAX_STACK, INVENTORY_SIZE, HOTBAR_SIZE } from '../types';

const VALID_BLOCK_IDS: ReadonlySet<number> = new Set<number>(Object.values(BlockId));

export class Inventory {
  private slots: (ItemStack | null)[];

  constructor() {
    this.slots = new Array<ItemStack | null>(INVENTORY_SIZE).fill(null);
  }

  getSlot(index: number): ItemStack | null {
    if (index < 0 || index >= INVENTORY_SIZE) return null;
    return this.slots[index] ?? null;
  }

  get allSlots(): ReadonlyArray<ItemStack | null> {
    return this.slots;
  }

  hotbarSlots(): ReadonlyArray<ItemStack | null> {
    return this.slots.slice(0, HOTBAR_SIZE);
  }

  selectedBlock(slot: number): BlockId {
    if (slot < 0 || slot >= HOTBAR_SIZE) return BlockId.AIR;
    const s = this.slots[slot] ?? null;
    return s !== null ? s.block : BlockId.AIR;
  }

  add(block: BlockId, count: number): number {
    if (block === BlockId.AIR || count <= 0) return count;

    let remaining = count;

    // First pass: top up existing stacks of the same block
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const s = this.slots[i] ?? null;
      if (s !== null && s.block === block && s.count < MAX_STACK) {
        const put = Math.min(MAX_STACK - s.count, remaining);
        s.count += put;
        remaining -= put;
        if (remaining === 0) return 0;
      }
    }

    // Second pass: fill empty slots with new stacks
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (this.slots[i] === null) {
        const put = Math.min(MAX_STACK, remaining);
        this.slots[i] = { block, count: put };
        remaining -= put;
        if (remaining === 0) return 0;
      }
    }

    return remaining;
  }

  removeOne(slot: number): boolean {
    if (slot < 0 || slot >= INVENTORY_SIZE) return false;
    const s = this.slots[slot] ?? null;
    if (s === null) return false;
    s.count -= 1;
    if (s.count <= 0) {
      this.slots[slot] = null;
    }
    return true;
  }

  setSlot(index: number, stack: ItemStack | null): void {
    if (index < 0 || index >= INVENTORY_SIZE) return;
    this.slots[index] = stack;
  }

  fillCreativePalette(palette: BlockId[]): void {
    this.slots = new Array<ItemStack | null>(INVENTORY_SIZE).fill(null);
    const limit = Math.min(palette.length, HOTBAR_SIZE);
    for (let i = 0; i < limit; i++) {
      const block = palette[i];
      if (block !== undefined) {
        this.slots[i] = { block, count: 1 };
      }
    }
  }

  serialize(): (ItemStack | null)[] {
    return this.slots.map(s => s !== null ? { block: s.block, count: s.count } : null);
  }

  deserialize(data: (ItemStack | null)[]): void {
    const fresh = new Array<ItemStack | null>(INVENTORY_SIZE).fill(null);
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const d = data[i] ?? null;
      if (
        d !== null &&
        typeof d === 'object' &&
        VALID_BLOCK_IDS.has(d.block) &&
        d.block !== BlockId.AIR &&
        Number.isFinite(d.count) &&
        d.count > 0
      ) {
        fresh[i] = {
          block: d.block,
          count: Math.max(1, Math.min(MAX_STACK, Math.floor(d.count))),
        };
      }
    }
    this.slots = fresh;
  }
}
