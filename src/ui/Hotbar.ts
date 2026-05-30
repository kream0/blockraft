import { HOTBAR_SIZE, type ItemStack } from '../types';
import type { ItemIconRenderer } from '../rendering/ItemIconRenderer';

const SLOT_COUNT = HOTBAR_SIZE;

interface SlotCache {
  item: number;
  count: number;
}

export class Hotbar {
  slots: HTMLElement[];
  selectedSlot: number;

  private root: HTMLElement;
  private showCounts: boolean;
  private iconRenderer: ItemIconRenderer;

  // Per-slot last-rendered state. null means slot was empty; sentinel -1 item ensures first call writes.
  private _slotCache: Array<SlotCache | null>;
  // Last selected index, -1 sentinel ensures first call applies highlight.
  private _lastSelected: number = -1;

  constructor(container: HTMLElement, stacks: ReadonlyArray<ItemStack | null>, showCounts: boolean, iconRenderer: ItemIconRenderer) {
    this.selectedSlot = 0;
    this.showCounts = showCounts;
    this.iconRenderer = iconRenderer;
    // Initialize per-slot cache with a sentinel that differs from any real stack,
    // so the first setStacks call unconditionally writes every slot.
    this._slotCache = Array.from({ length: SLOT_COUNT }, () => ({ item: -1, count: -1 }));

    const root = document.createElement('div');
    root.className = 'mc-hotbar';
    root.style.cssText = [
      'position: absolute',
      'left: 50%',
      'bottom: 24px',
      'transform: translateX(-50%)',
      'display: flex',
      'gap: 4px',
      'padding: 4px',
      'background: rgba(0,0,0,0.35)',
      'border-radius: 4px',
      'pointer-events: none',
      'user-select: none',
    ].join(';');

    this.slots = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement('div');

      slot.style.cssText = [
        'width: 32px',
        'height: 32px',
        'box-sizing: border-box',
        'border: 2px solid white',
        'background-color: transparent',
        'display: flex',
        'align-items: flex-end',
        'justify-content: flex-end',
        'font-family: monospace',
        'font-size: 10px',
        'color: white',
        'text-shadow: 1px 1px 2px black',
        'padding: 1px 2px',
        'background-size: contain',
        'background-repeat: no-repeat',
        'background-position: center',
      ].join(';');
      root.appendChild(slot);
      this.slots.push(slot);
    }

    container.appendChild(root);
    this.root = root;
    this.setStacks(stacks);
    this.setSelectedSlot(0);
  }

  setStacks(stacks: ReadonlyArray<ItemStack | null>): void {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = this.slots[i];
      if (slot === undefined) continue;
      const stack = stacks[i] ?? null;
      const cached = this._slotCache[i] ?? null;

      if (stack === null) {
        // Only write DOM when this slot was previously non-empty (or sentinel).
        if (cached !== null) {
          this._slotCache[i] = null;
          slot.style.backgroundImage = 'none';
          slot.style.backgroundColor = 'transparent';
          slot.textContent = '';
        }
      } else {
        // Only write DOM when item id or count changed since last render.
        if (cached === null || cached.item !== stack.item || cached.count !== stack.count) {
          this._slotCache[i] = { item: stack.item, count: stack.count };
          slot.style.backgroundColor = 'transparent';
          slot.style.backgroundImage = `url(${this.iconRenderer.getIcon(stack.item)})`;
          slot.textContent = (this.showCounts && stack.count > 1) ? String(stack.count) : '';
        }
      }
    }
  }

  setSelectedSlot(slot: number): void {
    if (slot < 0 || slot >= this.slots.length) return;
    if (slot === this._lastSelected) return;
    const prev = this.slots[this.selectedSlot];
    if (prev !== undefined) {
      prev.style.borderColor = 'white';
      prev.style.outline = '';
    }
    this.selectedSlot = slot;
    this._lastSelected = slot;
    const cur = this.slots[slot];
    if (cur !== undefined) {
      cur.style.borderColor = '#FFD24A';
      cur.style.outline = '2px solid #FFD24A';
    }
  }

  dispose(): void {
    if (this.root.parentNode !== null) {
      this.root.parentNode.removeChild(this.root);
    }
    this.slots = [];
  }
}
