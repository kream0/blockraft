import { INVENTORY_SIZE, HOTBAR_SIZE, CRAFTING_GRID_DIM, CRAFTING_GRID_SLOTS, type ItemStack, type ItemId } from '../types';
import type { Inventory } from '../player/Inventory';
import { itemMaxStack } from '../items/ItemRegistry';
import type { ItemIconRenderer } from '../rendering/ItemIconRenderer';
import { matchRecipe } from '../crafting/Recipes';

const CRAFT_INPUT_BASE = 100;   // synthetic indices 100..108 for the 3x3 inputs
const CRAFT_OUTPUT_INDEX = 200; // synthetic index for the output slot

export class InventoryScreen {
  isOpen: boolean = false;
  private inventory: Inventory;
  private iconRenderer: ItemIconRenderer;
  private root: HTMLElement;
  private slotEls: (HTMLElement | undefined)[];
  private cursorEl: HTMLElement;
  private cursor: ItemStack | null = null;
  private onMouseMove: (e: MouseEvent) => void;

  private craftGrid: (ItemStack | null)[] = new Array<ItemStack | null>(CRAFTING_GRID_SLOTS).fill(null);
  private craftOutput: ItemStack | null = null;
  private craftSlotEls: (HTMLElement | undefined)[] = new Array<HTMLElement | undefined>(CRAFTING_GRID_SLOTS).fill(undefined);
  private craftOutputEl: HTMLElement;

  private onSpill: ((item: ItemId, count: number) => void) | null;

  constructor(container: HTMLElement, inventory: Inventory, iconRenderer: ItemIconRenderer, onSpill?: (item: ItemId, count: number) => void) {
    this.inventory = inventory;
    this.iconRenderer = iconRenderer;
    this.onSpill = onSpill ?? null;
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

    // Crafting section: 3x3 grid → arrow → output slot
    const craftRow = document.createElement('div');
    craftRow.style.cssText = [
      'display:flex',
      'flex-direction:row',
      'align-items:center',
      'margin-bottom:8px',
    ].join(';');
    panel.appendChild(craftRow);

    const craftGridEl = document.createElement('div');
    craftGridEl.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(3, 40px)',
      'gap:4px',
    ].join(';');
    craftRow.appendChild(craftGridEl);

    for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
      const synthIndex = CRAFT_INPUT_BASE + i;
      const cell = this.buildCraftCell(synthIndex);
      this.craftSlotEls[i] = cell;
      craftGridEl.appendChild(cell);
    }

    const craftArrow = document.createElement('div');
    craftArrow.textContent = '→';
    craftArrow.style.cssText = 'margin:0 10px;font-size:18px;color:#aaa;';
    craftRow.appendChild(craftArrow);

    const craftOutputEl = this.buildCraftCell(CRAFT_OUTPUT_INDEX);
    craftRow.appendChild(craftOutputEl);
    this.craftOutputEl = craftOutputEl;

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
      this.cursorEl.style.top = (e.clientY - 17) + 'px';
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

  private buildSlotEl(invIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.dataset['index'] = String(invIndex);
    el.style.cssText = this.slotCss();
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotMouseDown(invIndex, e.button, e.shiftKey);
    });
    this.slotEls[invIndex] = el;
    return el;
  }

  /** Build a slot element for craft input/output synthetic indices. Does NOT write to slotEls. */
  private buildCraftCell(synthIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.dataset['index'] = String(synthIndex);
    el.style.cssText = this.slotCss();
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotMouseDown(synthIndex, e.button, e.shiftKey);
    });
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

  refresh(): void {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const el = this.slotEls[i];
      if (el === undefined) continue;
      this.paintTile(el, this.inventory.getSlot(i));
    }
    this.updateCursorEl();
    for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
      const el = this.craftSlotEls[i];
      if (el !== undefined) this.paintTile(el, this.craftGrid[i] ?? null);
    }
    this.paintTile(this.craftOutputEl, this.craftOutput);
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

  private getCell(index: number): ItemStack | null {
    if (index >= CRAFT_INPUT_BASE && index < CRAFT_INPUT_BASE + CRAFTING_GRID_SLOTS) {
      return this.craftGrid[index - CRAFT_INPUT_BASE] ?? null;
    }
    return this.inventory.getSlot(index);
  }

  private setCell(index: number, stack: ItemStack | null): void {
    if (index >= CRAFT_INPUT_BASE && index < CRAFT_INPUT_BASE + CRAFTING_GRID_SLOTS) {
      this.craftGrid[index - CRAFT_INPUT_BASE] = stack;
      return;
    }
    this.inventory.setSlot(index, stack);
  }

  private recomputeOutput(): void {
    const ids: (ItemId | null)[] = this.craftGrid.map(s => (s !== null ? s.item : null));
    this.craftOutput = matchRecipe(ids, CRAFTING_GRID_DIM);
  }

  private handleTakeResult(): void {
    if (this.craftOutput === null) return;
    const out = this.craftOutput;
    if (this.cursor === null) {
      this.cursor = { item: out.item, count: out.count };
    } else if (this.cursor.item === out.item && this.cursor.count + out.count <= itemMaxStack(out.item)) {
      this.cursor = { item: this.cursor.item, count: this.cursor.count + out.count };
    } else {
      // cursor holds a different item, or no room (e.g. tools maxStack=1) — can't take
      return;
    }
    // Consume exactly one of each non-empty input cell.
    for (let i = 0; i < this.craftGrid.length; i++) {
      const cell = this.craftGrid[i] ?? null;
      if (cell !== null) {
        const left = cell.count - 1;
        this.craftGrid[i] = left > 0 ? { item: cell.item, count: left } : null;
      }
    }
  }

  private handleShiftClick(index: number): void {
    if (index === CRAFT_OUTPUT_INDEX) {
      // Craft output: repeatedly craft-and-collect into main inventory until full or no output.
      for (let iter = 0; iter < 256; iter++) {
        const result = this.craftOutput;
        if (result === null) break;
        // Fill main inventory (9..35) first, then spill to hotbar — but only craft if it fully fits somewhere.
        if (!this.inventory.canAccept(result.item, result.count)) break; // would only partially fit anywhere — don't craft

        const leftover = this.inventory.addToRange(result.item, result.count, HOTBAR_SIZE, INVENTORY_SIZE);
        if (leftover > 0) this.inventory.add(result.item, leftover); // main full — spill remainder into hotbar

        // Consume exactly one of each non-empty input cell.
        for (let i = 0; i < CRAFTING_GRID_SLOTS; i++) {
          const ci = CRAFT_INPUT_BASE + i;
          const cell = this.getCell(ci);
          if (cell !== null) {
            const left = cell.count - 1;
            this.setCell(ci, left > 0 ? { item: cell.item, count: left } : null);
          }
        }

        this.recomputeOutput();
      }
    } else if (index >= CRAFT_INPUT_BASE && index < CRAFT_INPUT_BASE + CRAFTING_GRID_SLOTS) {
      // Craft input: move whole stack into the player inventory (full 0..35).
      const cell = this.getCell(index);
      if (cell === null) return;
      const leftover = this.inventory.add(cell.item, cell.count);
      this.setCell(index, leftover > 0 ? { item: cell.item, count: leftover } : null);
      this.recomputeOutput();
    } else if (index < HOTBAR_SIZE) {
      // Hotbar (0..8): move whole stack into main inventory (9..35).
      const cell = this.getCell(index);
      if (cell === null) return;
      const leftover = this.inventory.addToRange(cell.item, cell.count, HOTBAR_SIZE, INVENTORY_SIZE);
      this.setCell(index, leftover > 0 ? { item: cell.item, count: leftover } : null);
    } else {
      // Main inventory (9..35): move whole stack into hotbar (0..8).
      const cell = this.getCell(index);
      if (cell === null) return;
      const leftover = this.inventory.addToRange(cell.item, cell.count, 0, HOTBAR_SIZE);
      this.setCell(index, leftover > 0 ? { item: cell.item, count: leftover } : null);
    }

    this.refresh();
  }

  private handleSlotMouseDown(index: number, button: number, shiftKey: boolean): void {
    if (shiftKey) { this.handleShiftClick(index); return; }

    // Output slot: take crafted result then return early.
    if (index === CRAFT_OUTPUT_INDEX) {
      this.handleTakeResult();
      this.recomputeOutput();
      this.refresh();
      return;
    }

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

    // Recompute output after any change (cheap, harmless on inventory-only clicks).
    this.recomputeOutput();
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
      const heldItem = this.cursor.item;
      const leftover = this.inventory.add(this.cursor.item, this.cursor.count);
      if (leftover > 0) {
        if (this.onSpill !== null) {
          this.onSpill(heldItem, leftover);
        } else {
          console.error(`[InventoryScreen] close() could not return ${leftover} held item(s) — inventory full`);
        }
      }
      this.cursor = null;
    }
    // Return craft-grid inputs to the inventory (conservation: no item loss on close).
    // The output slot is a computed preview — do NOT add it to the inventory.
    for (let i = 0; i < this.craftGrid.length; i++) {
      const cell = this.craftGrid[i] ?? null;
      if (cell !== null) {
        const cellItem = cell.item;
        const leftover = this.inventory.add(cell.item, cell.count);
        if (leftover > 0) {
          if (this.onSpill !== null) {
            this.onSpill(cellItem, leftover);
          } else {
            console.error(`[InventoryScreen] close() could not return ${leftover} craft input(s) — inventory full`);
          }
        }
        this.craftGrid[i] = null;
      }
    }
    this.craftOutput = null;
    this.isOpen = false;
    this.root.style.display = 'none';
    this.updateCursorEl();
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  dispose(): void {
    // Route teardown through close() so a held cursor stack is returned to the
    // inventory, craft inputs are returned, and the mousemove listener is removed.
    this.close();
    if (this.root.parentNode !== null) {
      this.root.parentNode.removeChild(this.root);
    }
    this.slotEls = [];
    this.craftSlotEls = [];
  }
}
