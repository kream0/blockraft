import { BlockId, ItemStack, INVENTORY_SIZE, HOTBAR_SIZE, type ItemId } from '../types';
import { itemMaxStack, itemPlaceableBlock, isKnownItem } from '../items/ItemRegistry';

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
    return s !== null ? (itemPlaceableBlock(s.item) ?? BlockId.AIR) : BlockId.AIR;
  }

  /**
   * Like add(), but only fills slots in [start, end). Merges into existing
   * same-item partial stacks first, then empty slots. Returns leftover count.
   */
  addToRange(item: ItemId, count: number, start: number, end: number): number {
    if (item === BlockId.AIR || count <= 0) return count;

    const lo = Math.max(0, start);
    const hi = Math.min(INVENTORY_SIZE, end);
    if (lo >= hi) return count;

    let remaining = count;
    const maxStack = itemMaxStack(item);

    // First pass: top up existing stacks of the same item within range
    for (let i = lo; i < hi; i++) {
      const s = this.slots[i] ?? null;
      if (s !== null && s.item === item && s.count < maxStack) {
        const put = Math.min(maxStack - s.count, remaining);
        s.count += put;
        remaining -= put;
        if (remaining === 0) return 0;
      }
    }

    // Second pass: fill empty slots within range with new stacks
    for (let i = lo; i < hi; i++) {
      if (this.slots[i] === null) {
        const put = Math.min(maxStack, remaining);
        this.slots[i] = { item, count: put };
        remaining -= put;
        if (remaining === 0) return 0;
      }
    }

    return remaining;
  }

  add(item: ItemId, count: number): number {
    return this.addToRange(item, count, 0, INVENTORY_SIZE);
  }

  /** True if `count` of `item` fully fits in slots [start, end) (merging into partials + empty slots). */
  canAccept(item: ItemId, count: number, start = 0, end = INVENTORY_SIZE): boolean {
    if (item === BlockId.AIR) return false;
    if (count <= 0) return true;
    const lo = Math.max(0, start);
    const hi = Math.min(INVENTORY_SIZE, end);
    const maxStack = itemMaxStack(item);
    let capacity = 0;
    for (let i = lo; i < hi; i++) {
      const s = this.slots[i] ?? null;
      if (s === null) capacity += maxStack;
      else if (s.item === item && s.count < maxStack) capacity += maxStack - s.count;
      if (capacity >= count) return true;
    }
    return capacity >= count;
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

  fillCreativePalette(palette: ItemId[]): void {
    this.slots = new Array<ItemStack | null>(INVENTORY_SIZE).fill(null);
    const limit = Math.min(palette.length, HOTBAR_SIZE);
    for (let i = 0; i < limit; i++) {
      const item = palette[i];
      if (item !== undefined) {
        this.slots[i] = { item, count: 1 };
      }
    }
  }

  serialize(): (ItemStack | null)[] {
    return this.slots.map(s => s !== null ? { item: s.item, count: s.count } : null);
  }

  deserialize(data: (ItemStack | null)[]): void {
    const fresh = new Array<ItemStack | null>(INVENTORY_SIZE).fill(null);
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const d = data[i] ?? null;
      if (d !== null && typeof d === 'object') {
        // Support legacy saves that stored { block, count } as well as new { item, count }.
        const raw = d as { item?: number; block?: number; count?: number };
        const id: number | undefined = raw.item ?? raw.block;
        const cnt: number | undefined = raw.count;
        if (
          id !== undefined &&
          isKnownItem(id) &&
          id !== BlockId.AIR &&
          cnt !== undefined &&
          Number.isFinite(cnt) &&
          cnt > 0
        ) {
          fresh[i] = {
            item: id,
            count: Math.max(1, Math.min(itemMaxStack(id), Math.floor(cnt))),
          };
        }
      }
    }
    this.slots = fresh;
  }
}
