import { INVENTORY_SIZE, HOTBAR_SIZE, CHEST_SLOTS, type ItemId, type ItemStack, type ChestState } from '../types';
import type { Inventory } from '../player/Inventory';
import { itemMaxStack } from '../items/ItemRegistry';
import type { ItemIconRenderer } from '../rendering/ItemIconRenderer';
import { Tooltip, itemDisplayName } from './Tooltip';

// Synthetic slot indices for the 27 chest slots — must not collide with real
// inventory indices 0..35, furnace indices 300..302, or craft indices 100..200.
const CHEST_SLOT_BASE = 400;

export class ChestScreen {
  isOpen: boolean = false;

  private inventory: Inventory;
  private iconRenderer: ItemIconRenderer;
  private state: ChestState | null = null;

  private root: HTMLElement;
  private slotEls: (HTMLElement | undefined)[];
  private chestSlotEls: (HTMLElement | undefined)[];
  private cursorEl: HTMLElement;
  private cursor: ItemStack | null = null;
  private onMouseMove: (e: MouseEvent) => void;
  private tooltip: Tooltip;

  private onSpill: ((item: ItemId, count: number) => void) | null;

  constructor(container: HTMLElement, inventory: Inventory, iconRenderer: ItemIconRenderer, onSpill?: (item: ItemId, count: number) => void) {
    this.inventory = inventory;
    this.iconRenderer = iconRenderer;
    this.onSpill = onSpill ?? null;
    this.slotEls = new Array<HTMLElement | undefined>(INVENTORY_SIZE).fill(undefined);
    this.chestSlotEls = new Array<HTMLElement | undefined>(CHEST_SLOTS).fill(undefined);

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
    this.tooltip = new Tooltip(root);

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
    title.textContent = 'Chest';
    title.style.cssText = 'font-size:13px;margin-bottom:6px;color:#ccc;';
    panel.appendChild(title);

    // Chest grid: 27 slots, 3 rows × 9 columns
    const chestGrid = document.createElement('div');
    chestGrid.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(9, 40px)',
      'gap:4px',
      'margin-bottom:8px',
    ].join(';');
    panel.appendChild(chestGrid);

    for (let i = 0; i < CHEST_SLOTS; i++) {
      const synthIndex = CHEST_SLOT_BASE + i;
      const el = this.buildChestSlotEl(synthIndex, i);
      chestGrid.appendChild(el);
    }

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
      'background-size:contain',
      'background-repeat:no-repeat',
      'background-position:center',
    ].join(';');
    cursorEl.style.display = 'none';
    root.appendChild(cursorEl);
    this.cursorEl = cursorEl;

    // Mouse-move handler (stored for add/remove by open/close)
    this.onMouseMove = (e: MouseEvent): void => {
      this.cursorEl.style.left = (e.clientX - 17) + 'px';
      this.cursorEl.style.top  = (e.clientY - 17) + 'px';
    };
  }

  private slotCss(): string {
    return [
      'width:40px',
      'height:40px',
      'box-sizing:border-box',
      'border:2px solid #555',
      'background-color:transparent',
      'display:flex',
      'align-items:flex-end',
      'justify-content:flex-end',
      'font-size:11px',
      'text-shadow:1px 1px 2px black',
      'padding:1px 3px',
      'cursor:default',
      'background-size:contain',
      'background-repeat:no-repeat',
      'background-position:center',
    ].join(';');
  }

  /** Build a regular inventory slot element and register it in slotEls[]. */
  private buildSlotEl(invIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.dataset['index'] = String(invIndex);
    el.style.cssText = this.slotCss();
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotMouseDown(invIndex, e.button);
    });
    el.addEventListener('mousemove', (e: MouseEvent) => {
      const stack = this.getCell(invIndex);
      if (stack !== null) {
        this.tooltip.show(itemDisplayName(stack.item), e.clientX, e.clientY);
      } else {
        this.tooltip.hide();
      }
    });
    el.addEventListener('mouseleave', () => {
      this.tooltip.hide();
    });
    this.slotEls[invIndex] = el;
    return el;
  }

  /** Build a chest slot element (synthetic index; stored in chestSlotEls[chestI]). */
  private buildChestSlotEl(synthIndex: number, chestI: number): HTMLElement {
    const el = document.createElement('div');
    el.dataset['index'] = String(synthIndex);
    el.style.cssText = this.slotCss();
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotMouseDown(synthIndex, e.button);
    });
    el.addEventListener('mousemove', (e: MouseEvent) => {
      const stack = this.getCell(synthIndex);
      if (stack !== null) {
        this.tooltip.show(itemDisplayName(stack.item), e.clientX, e.clientY);
      } else {
        this.tooltip.hide();
      }
    });
    el.addEventListener('mouseleave', () => {
      this.tooltip.hide();
    });
    this.chestSlotEls[chestI] = el;
    return el;
  }

  private paintTile(el: HTMLElement, stack: ItemStack | null): void {
    if (stack === null) {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = 'transparent';
      el.textContent = '';
    } else {
      el.style.backgroundColor = 'transparent';
      el.style.backgroundImage = `url(${this.iconRenderer.getIcon(stack.item)})`;
      el.textContent = stack.count > 1 ? String(stack.count) : '';
    }
  }

  private updateCursorEl(): void {
    if (this.cursor === null) {
      this.cursorEl.style.backgroundImage = 'none';
      this.cursorEl.style.backgroundColor = 'transparent';
      this.cursorEl.textContent = '';
      this.cursorEl.style.display = 'none';
    } else {
      this.cursorEl.style.backgroundColor = 'transparent';
      this.cursorEl.style.backgroundImage = `url(${this.iconRenderer.getIcon(this.cursor.item)})`;
      this.cursorEl.textContent = this.cursor.count > 1 ? String(this.cursor.count) : '';
      this.cursorEl.style.display = 'flex';
    }
  }

  /** Read from the appropriate slot (chest or inventory). Returns null if state not bound. */
  private getCell(index: number): ItemStack | null {
    if (index >= CHEST_SLOT_BASE && index < CHEST_SLOT_BASE + CHEST_SLOTS) {
      if (this.state === null) return null;
      return this.state.slots[index - CHEST_SLOT_BASE] ?? null;
    }
    return this.inventory.getSlot(index);
  }

  /** Write to the appropriate slot (chest or inventory). No-op if state not bound for chest slots. */
  private setCell(index: number, stack: ItemStack | null): void {
    if (index >= CHEST_SLOT_BASE && index < CHEST_SLOT_BASE + CHEST_SLOTS) {
      if (this.state === null) return;
      this.state.slots[index - CHEST_SLOT_BASE] = stack;
      return;
    }
    this.inventory.setSlot(index, stack);
  }

  private handleSlotMouseDown(index: number, button: number): void {
    const slot = this.getCell(index);

    if (button === 0) {
      // Left click
      if (this.cursor === null) {
        if (slot !== null) {
          // Pick up whole stack
          this.cursor = { item: slot.item, count: slot.count };
          this.setCell(index, null);
        }
        // slot null → nothing
      } else {
        // cursor not null
        if (slot === null) {
          // Drop whole cursor
          this.setCell(index, { item: this.cursor.item, count: this.cursor.count });
          this.cursor = null;
        } else if (slot.item === this.cursor.item) {
          // Same item type: merge up to per-item maxStack
          const maxStack = itemMaxStack(slot.item);
          const space = maxStack - slot.count;
          const move = Math.min(space, this.cursor.count);
          if (move > 0) {
            this.setCell(index, { item: slot.item, count: slot.count + move });
            const left = this.cursor.count - move;
            this.cursor = left > 0 ? { item: this.cursor.item, count: left } : null;
          } else {
            // Slot is already full: swap
            const tmp: ItemStack = { item: slot.item, count: slot.count };
            this.setCell(index, { item: this.cursor.item, count: this.cursor.count });
            this.cursor = tmp;
          }
        } else {
          // Different item type: swap
          const tmp: ItemStack = { item: slot.item, count: slot.count };
          this.setCell(index, { item: this.cursor.item, count: this.cursor.count });
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
          this.cursor = { item: slot.item, count: take };
          this.setCell(index, keep > 0 ? { item: slot.item, count: keep } : null);
        }
        // slot null → nothing
      } else {
        // cursor not null
        if (slot === null) {
          // Drop ONE
          this.setCell(index, { item: this.cursor.item, count: 1 });
          const left = this.cursor.count - 1;
          this.cursor = left > 0 ? { item: this.cursor.item, count: left } : null;
        } else if (slot.item === this.cursor.item && slot.count < itemMaxStack(slot.item)) {
          // Same type with room: add ONE
          this.setCell(index, { item: slot.item, count: slot.count + 1 });
          const left = this.cursor.count - 1;
          this.cursor = left > 0 ? { item: this.cursor.item, count: left } : null;
        }
        // else → nothing
      }
    }

    this.refresh();
  }

  refresh(): void {
    // Paint all 36 inventory slots
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const el = this.slotEls[i];
      if (el === undefined) continue;
      this.paintTile(el, this.inventory.getSlot(i));
    }

    // Paint all 27 chest slots (read from live state if bound, else show empty)
    for (let i = 0; i < CHEST_SLOTS; i++) {
      const el = this.chestSlotEls[i];
      if (el === undefined) continue;
      const stack = (this.state !== null) ? (this.state.slots[i] ?? null) : null;
      this.paintTile(el, stack);
    }

    this.updateCursorEl();
  }

  open(state: ChestState): void {
    this.state = state;
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.refresh();
    window.addEventListener('mousemove', this.onMouseMove);
  }

  close(): void {
    // Return any cursor-held stack to the player inventory (conservation invariant).
    // Do NOT touch the 27 chest slots — they belong to the chest's ChestState.
    if (this.cursor !== null) {
      const heldItem = this.cursor.item;
      const leftover = this.inventory.add(this.cursor.item, this.cursor.count);
      if (leftover > 0) {
        if (this.onSpill !== null) {
          this.onSpill(heldItem, leftover);
        } else {
          console.error(`[ChestScreen] close() could not return ${leftover} held item(s) — inventory full`);
        }
      }
      this.cursor = null;
    }
    this.state = null;
    this.isOpen = false;
    this.root.style.display = 'none';
    this.updateCursorEl();
    window.removeEventListener('mousemove', this.onMouseMove);
    this.tooltip.hide();
  }

  dispose(): void {
    // Route through close() so the cursor is returned and the mousemove listener removed.
    this.close();
    this.tooltip.dispose();
    if (this.root.parentNode !== null) {
      this.root.parentNode.removeChild(this.root);
    }
    this.slotEls = [];
    this.chestSlotEls = [];
  }
}
