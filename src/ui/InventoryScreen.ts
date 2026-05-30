import { INVENTORY_SIZE, HOTBAR_SIZE, MAX_STACK, type ItemStack } from '../types';
import type { Inventory } from '../player/Inventory';
import { SWATCH_COLORS } from './Hotbar';

export class InventoryScreen {
  isOpen: boolean = false;
  private inventory: Inventory;
  private root: HTMLElement;
  private slotEls: (HTMLElement | undefined)[];
  private cursorEl: HTMLElement;
  private cursor: ItemStack | null = null;
  private onMouseMove: (e: MouseEvent) => void;

  constructor(container: HTMLElement, inventory: Inventory) {
    this.inventory = inventory;
    this.slotEls = new Array<HTMLElement | undefined>(INVENTORY_SIZE).fill(undefined);

    // Full-screen overlay backdrop
    const root = document.createElement('div');
    root.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:50',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.6)',
      'pointer-events:auto',
      'user-select:none',
    ].join(';');
    root.style.display = 'none';
    root.addEventListener('contextmenu', e => e.preventDefault());
    container.appendChild(root);
    this.root = root;

    // Centered panel
    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:rgba(30,30,30,0.95)',
      'padding:16px',
      'border-radius:6px',
      'font-family:monospace',
      'color:white',
      'display:flex',
      'flex-direction:column',
      'gap:4px',
    ].join(';');
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    title.textContent = 'Inventory';
    title.style.cssText = 'font-size:13px;margin-bottom:6px;color:#ccc;';
    panel.appendChild(title);

    // Backpack grid: slots 9..35 (27 slots, 3 rows × 9)
    const backpackGrid = document.createElement('div');
    backpackGrid.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(9, 40px)',
      'gap:4px',
    ].join(';');
    panel.appendChild(backpackGrid);

    for (let i = 0; i < 27; i++) {
      const invIndex = HOTBAR_SIZE + i; // slots 9..35
      const el = this.buildSlotEl(invIndex);
      backpackGrid.appendChild(el);
    }

    // Vertical gap between backpack and hotbar
    const gap = document.createElement('div');
    gap.style.height = '10px';
    panel.appendChild(gap);

    // Hotbar grid: slots 0..8 (9 slots, 1 row × 9)
    const hotbarGrid = document.createElement('div');
    hotbarGrid.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(9, 40px)',
      'gap:4px',
    ].join(';');
    panel.appendChild(hotbarGrid);

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const invIndex = i; // slots 0..8
      const el = this.buildSlotEl(invIndex);
      hotbarGrid.appendChild(el);
    }

    // Floating cursor tile
    const cursorEl = document.createElement('div');
    cursorEl.style.cssText = [
      'position:fixed',
      'z-index:60',
      'width:34px',
      'height:34px',
      'pointer-events:none',
      'display:flex',
      'align-items:flex-end',
      'justify-content:flex-end',
      'font-size:11px',
      'color:white',
      'text-shadow:1px 1px 2px black',
    ].join(';');
    cursorEl.style.display = 'none';
    root.appendChild(cursorEl);
    this.cursorEl = cursorEl;

    // Mouse-move handler (stored for add/remove by open/close)
    this.onMouseMove = (e: MouseEvent): void => {
      this.cursorEl.style.left = (e.clientX - 17) + 'px';
      this.cursorEl.style.top = (e.clientY - 17) + 'px';
    };
  }

  private buildSlotEl(invIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.dataset['index'] = String(invIndex);
    el.style.cssText = [
      'width:40px',
      'height:40px',
      'box-sizing:border-box',
      'border:2px solid #555',
      'background:transparent',
      'display:flex',
      'align-items:flex-end',
      'justify-content:flex-end',
      'font-size:11px',
      'text-shadow:1px 1px 2px black',
      'padding:1px 3px',
      'cursor:default',
    ].join(';');
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotMouseDown(invIndex, e.button);
    });
    this.slotEls[invIndex] = el;
    return el;
  }

  private paintTile(el: HTMLElement, stack: ItemStack | null): void {
    if (stack === null) {
      el.style.background = 'transparent';
      el.textContent = '';
    } else {
      el.style.background = SWATCH_COLORS[stack.block] ?? '#444444';
      el.textContent = stack.count > 1 ? String(stack.count) : '';
    }
  }

  refresh(): void {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const el = this.slotEls[i];
      if (el === undefined) continue;
      this.paintTile(el, this.inventory.getSlot(i));
    }
    this.updateCursorEl();
  }

  private updateCursorEl(): void {
    if (this.cursor === null) {
      this.cursorEl.style.background = 'transparent';
      this.cursorEl.textContent = '';
      this.cursorEl.style.display = 'none';
    } else {
      this.cursorEl.style.background = SWATCH_COLORS[this.cursor.block] ?? '#444444';
      this.cursorEl.textContent = this.cursor.count > 1 ? String(this.cursor.count) : '';
      this.cursorEl.style.display = 'flex';
    }
  }

  private handleSlotMouseDown(index: number, button: number): void {
    const slot = this.inventory.getSlot(index);

    if (button === 0) {
      // Left click
      if (this.cursor === null) {
        if (slot !== null) {
          // Pick up whole stack
          this.cursor = { block: slot.block, count: slot.count };
          this.inventory.setSlot(index, null);
        }
        // slot null → nothing
      } else {
        // cursor not null
        if (slot === null) {
          // Drop whole cursor
          this.inventory.setSlot(index, { block: this.cursor.block, count: this.cursor.count });
          this.cursor = null;
        } else if (slot.block === this.cursor.block) {
          // Same block type: merge up to MAX_STACK
          const space = MAX_STACK - slot.count;
          const move = Math.min(space, this.cursor.count);
          if (move > 0) {
            this.inventory.setSlot(index, { block: slot.block, count: slot.count + move });
            const left = this.cursor.count - move;
            this.cursor = left > 0 ? { block: this.cursor.block, count: left } : null;
          } else {
            // Slot is already full: swap
            const tmp: ItemStack = { block: slot.block, count: slot.count };
            this.inventory.setSlot(index, { block: this.cursor.block, count: this.cursor.count });
            this.cursor = tmp;
          }
        } else {
          // Different block type: swap
          const tmp: ItemStack = { block: slot.block, count: slot.count };
          this.inventory.setSlot(index, { block: this.cursor.block, count: this.cursor.count });
          this.cursor = tmp;
        }
      }
    } else if (button === 2) {
      // Right click
      if (this.cursor === null) {
        if (slot !== null) {
          // Take half (ceil)
          const take = Math.ceil(slot.count / 2);
          const keep = slot.count - take;
          this.cursor = { block: slot.block, count: take };
          this.inventory.setSlot(index, keep > 0 ? { block: slot.block, count: keep } : null);
        }
        // slot null → nothing
      } else {
        // cursor not null
        if (slot === null) {
          // Drop ONE
          this.inventory.setSlot(index, { block: this.cursor.block, count: 1 });
          const left = this.cursor.count - 1;
          this.cursor = left > 0 ? { block: this.cursor.block, count: left } : null;
        } else if (slot.block === this.cursor.block && slot.count < MAX_STACK) {
          // Same type with room: add ONE
          this.inventory.setSlot(index, { block: slot.block, count: slot.count + 1 });
          const left = this.cursor.count - 1;
          this.cursor = left > 0 ? { block: this.cursor.block, count: left } : null;
        }
        // else → nothing
      }
    }

    this.refresh();
  }

  open(): void {
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.refresh();
    window.addEventListener('mousemove', this.onMouseMove);
  }

  close(): void {
    if (this.cursor !== null) {
      // Return held items to the inventory (conservation invariant: always fits)
      const leftover = this.inventory.add(this.cursor.block, this.cursor.count);
      if (leftover > 0) {
        console.error(`[InventoryScreen] close() could not return ${leftover} held item(s) — inventory full`);
      }
      this.cursor = null;
    }
    this.isOpen = false;
    this.root.style.display = 'none';
    this.updateCursorEl();
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  dispose(): void {
    // Route teardown through close() so a held cursor stack is returned to the
    // inventory and the mousemove listener is removed via the canonical path.
    this.close();
    if (this.root.parentNode !== null) {
      this.root.parentNode.removeChild(this.root);
    }
    this.slotEls = [];
  }
}
