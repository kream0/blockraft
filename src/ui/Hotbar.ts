import { BlockId, HOTBAR_SIZE, type ItemStack } from '../types';

const SWATCH_COLORS: Record<number, string> = {
  [BlockId.AIR]: '#00000000',
  [BlockId.GRASS]: '#5DAD3A',
  [BlockId.DIRT]: '#8B5A2B',
  [BlockId.STONE]: '#888888',
  [BlockId.COBBLESTONE]: '#777777',
  [BlockId.WOOD]: '#6E4923',
  [BlockId.LEAVES]: '#3F7E2A',
  [BlockId.PLANKS]: '#B6824A',
  [BlockId.SAND]: '#E2D2A0',
  [BlockId.GLASS]: '#A8D0E6',
  [BlockId.BEDROCK]: '#4A4A4A',
  [BlockId.SNOW]: '#EAF2F8',
  [BlockId.WATER]: '#3B6FCB',
  [BlockId.COAL_ORE]: '#2B2B2B',
  [BlockId.IRON_ORE]: '#C8865A',
};

const SLOT_COUNT = HOTBAR_SIZE;

export class Hotbar {
  slots: HTMLElement[];
  selectedSlot: number;

  private root: HTMLElement;
  private showCounts: boolean;

  constructor(container: HTMLElement, stacks: ReadonlyArray<ItemStack | null>, showCounts: boolean) {
    this.selectedSlot = 0;
    this.showCounts = showCounts;

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
        'background: transparent',
        'display: flex',
        'align-items: flex-end',
        'justify-content: flex-end',
        'font-family: monospace',
        'font-size: 10px',
        'color: white',
        'text-shadow: 1px 1px 2px black',
        'padding: 1px 2px',
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
      if (stack === null) {
        slot.style.background = 'transparent';
        slot.textContent = '';
      } else {
        slot.style.background = SWATCH_COLORS[stack.block] ?? '#444444';
        slot.textContent = (this.showCounts && stack.count > 1) ? String(stack.count) : '';
      }
    }
  }

  setSelectedSlot(slot: number): void {
    if (slot < 0 || slot >= this.slots.length) return;
    const prev = this.slots[this.selectedSlot];
    if (prev !== undefined) {
      prev.style.borderColor = 'white';
      prev.style.outline = '';
    }
    this.selectedSlot = slot;
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
