import { INVENTORY_SIZE, HOTBAR_SIZE, SMELT_DURATION_S, type ItemId, type ItemStack, type FurnaceState } from '../types';
import type { Inventory } from '../player/Inventory';
import { itemMaxStack } from '../items/ItemRegistry';
import type { ItemIconRenderer } from '../rendering/ItemIconRenderer';
import { getSmeltingRecipe, getFuelDef } from '../crafting/Smelting';
import { Tooltip, itemDisplayName } from './Tooltip';

// Synthetic slot indices for the three furnace slots — must not collide with real
// inventory indices 0..35.
const FURNACE_INPUT  = 300;
const FURNACE_FUEL   = 301;
const FURNACE_OUTPUT = 302;

export class FurnaceScreen {
  isOpen: boolean = false;

  private inventory: Inventory;
  private iconRenderer: ItemIconRenderer;
  private state: FurnaceState | null = null;

  private root: HTMLElement;
  private slotEls: (HTMLElement | undefined)[];
  private cursorEl: HTMLElement;
  private cursor: ItemStack | null = null;
  private onMouseMove: (e: MouseEvent) => void;
  private tooltip: Tooltip;

  // Furnace slot elements
  private furnaceInputEl: HTMLElement;
  private furnaceFuelEl: HTMLElement;
  private furnaceOutputEl: HTMLElement;

  // Gauge elements
  private flameGaugeFillEl: HTMLElement;
  private progressArrowFillEl: HTMLElement;
  // Fixed track width for progress arrow fill math
  private readonly ARROW_TRACK_WIDTH = 48;

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
    title.textContent = 'Furnace';
    title.style.cssText = 'font-size:13px;margin-bottom:6px;color:#ccc;';
    panel.appendChild(title);

    // Furnace row: [input+flame+fuel column] [arrow track] [output slot]
    const furnaceRow = document.createElement('div');
    furnaceRow.style.cssText = [
      'display:flex',
      'flex-direction:row',
      'align-items:center',
      'margin-bottom:8px',
      'gap:8px',
    ].join(';');
    panel.appendChild(furnaceRow);

    // Left column: input slot / flame gauge / fuel slot
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:4px',
    ].join(';');
    furnaceRow.appendChild(leftColumn);

    // Input slot
    const inputEl = this.buildFurnaceSlot(FURNACE_INPUT);
    leftColumn.appendChild(inputEl);
    this.furnaceInputEl = inputEl;

    // Flame gauge container (16px wide × 18px tall; orange fill anchored to bottom)
    const flameContainer = document.createElement('div');
    flameContainer.style.cssText = [
      'width:16px',
      'height:18px',
      'background:#333',
      'border:1px solid #555',
      'border-radius:2px',
      'overflow:hidden',
      'display:flex',
      'flex-direction:column',
      'justify-content:flex-end',
    ].join(';');
    leftColumn.appendChild(flameContainer);

    const flameGaugeFill = document.createElement('div');
    flameGaugeFill.style.cssText = [
      'width:100%',
      'height:0%',
      'background:#f80',
      'transition:height 0.1s linear',
    ].join(';');
    flameContainer.appendChild(flameGaugeFill);
    this.flameGaugeFillEl = flameGaugeFill;

    // Fuel slot
    const fuelEl = this.buildFurnaceSlot(FURNACE_FUEL);
    leftColumn.appendChild(fuelEl);
    this.furnaceFuelEl = fuelEl;

    // Progress arrow track (48px wide × 14px tall; green fill from left)
    const arrowTrack = document.createElement('div');
    arrowTrack.style.cssText = [
      `width:${this.ARROW_TRACK_WIDTH}px`,
      'height:14px',
      'background:#333',
      'border:1px solid #555',
      'border-radius:2px',
      'overflow:hidden',
      'position:relative',
    ].join(';');
    furnaceRow.appendChild(arrowTrack);

    // Arrow label centered over the track
    const arrowLabel = document.createElement('div');
    arrowLabel.textContent = '→';
    arrowLabel.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:12px',
      'color:#777',
      'pointer-events:none',
    ].join(';');
    arrowTrack.appendChild(arrowLabel);

    const progressFill = document.createElement('div');
    progressFill.style.cssText = [
      'height:100%',
      'width:0%',
      'background:rgba(80,200,80,0.55)',
      'transition:width 0.1s linear',
    ].join(';');
    arrowTrack.appendChild(progressFill);
    this.progressArrowFillEl = progressFill;

    // Output slot
    const outputEl = this.buildFurnaceSlot(FURNACE_OUTPUT);
    furnaceRow.appendChild(outputEl);
    this.furnaceOutputEl = outputEl;

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
      this.handleSlotMouseDown(invIndex, e.button, e.shiftKey);
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

  /** Build a furnace slot element (synthetic index; NOT written to slotEls[]). */
  private buildFurnaceSlot(synthIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.dataset['index'] = String(synthIndex);
    el.style.cssText = this.slotCss();
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSlotMouseDown(synthIndex, e.button, e.shiftKey);
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

  /** Read from the appropriate slot (furnace or inventory). Returns null if state not bound. */
  private getCell(index: number): ItemStack | null {
    if (index === FURNACE_INPUT || index === FURNACE_FUEL || index === FURNACE_OUTPUT) {
      if (this.state === null) return null;
      if (index === FURNACE_INPUT)  return this.state.input;
      if (index === FURNACE_FUEL)   return this.state.fuel;
      // index === FURNACE_OUTPUT
      return this.state.output;
    }
    return this.inventory.getSlot(index);
  }

  /** Write to the appropriate slot (furnace or inventory). No-op if state not bound for furnace slots. */
  private setCell(index: number, stack: ItemStack | null): void {
    if (index === FURNACE_INPUT || index === FURNACE_FUEL || index === FURNACE_OUTPUT) {
      if (this.state === null) return;
      if (index === FURNACE_INPUT)  { this.state.input  = stack; return; }
      if (index === FURNACE_FUEL)   { this.state.fuel   = stack; return; }
      // index === FURNACE_OUTPUT
      this.state.output = stack;
      return;
    }
    this.inventory.setSlot(index, stack);
  }

  /** Move the whole stack from a furnace synthetic slot into player inventory (backpack first, then hotbar). */
  private quickMoveFurnaceToPlayer(furnaceSlot: number): void {
    const stack = this.getCell(furnaceSlot);
    if (stack === null) return;
    // backpack (9..35) first, then hotbar (0..8) — consistent with InventoryScreen
    let leftover = this.inventory.addToRange(stack.item, stack.count, HOTBAR_SIZE, INVENTORY_SIZE);
    if (leftover > 0) leftover = this.inventory.addToRange(stack.item, leftover, 0, HOTBAR_SIZE);
    this.setCell(furnaceSlot, leftover > 0 ? { item: stack.item, count: leftover } : null);
  }

  /** Move an inventory stack into a furnace input/fuel slot — merge same-item, never swap. */
  private quickMoveToFurnaceSlot(invIndex: number, furnaceSlot: number): void {
    const src = this.inventory.getSlot(invIndex);
    if (src === null) return;
    const dst = this.getCell(furnaceSlot);
    if (dst === null) {
      this.setCell(furnaceSlot, { item: src.item, count: src.count });
      this.inventory.setSlot(invIndex, null);
    } else if (dst.item === src.item) {
      const space = itemMaxStack(src.item) - dst.count;
      const move = Math.min(space, src.count);
      if (move > 0) {
        this.setCell(furnaceSlot, { item: dst.item, count: dst.count + move });
        const left = src.count - move;
        this.inventory.setSlot(invIndex, left > 0 ? { item: src.item, count: left } : null);
      }
      // furnace slot full → no-op
    }
    // different item already in furnace slot → no-op (shift-click never swaps)
  }

  private handleShiftClick(index: number): void {
    if (this.state === null) return;

    if (index === FURNACE_OUTPUT || index === FURNACE_INPUT || index === FURNACE_FUEL) {
      // Move the whole furnace slot stack into player inventory.
      this.quickMoveFurnaceToPlayer(index);
    } else {
      // Inventory slot (0..35): route item into furnace based on type.
      const src = this.inventory.getSlot(index);
      if (src === null) return;
      if (getSmeltingRecipe(src.item) !== null) {
        // Smeltable items go to the INPUT slot (takes priority over fuel).
        this.quickMoveToFurnaceSlot(index, FURNACE_INPUT);
      } else if (getFuelDef(src.item) !== null) {
        // Fuel-only items go to the FUEL slot.
        this.quickMoveToFurnaceSlot(index, FURNACE_FUEL);
      }
      // Neither smeltable nor fuel → no-op.
    }

    this.refresh();
  }

  private handleSlotMouseDown(index: number, button: number, shiftKey: boolean): void {
    if (shiftKey) { this.handleShiftClick(index); return; }

    // Output slot: take-only rule — never deposit into it.
    if (index === FURNACE_OUTPUT) {
      if (this.state === null) return;
      const out = this.state.output;
      if (out === null) return; // nothing to take

      if (this.cursor === null) {
        // Pick up the whole output stack regardless of button.
        this.cursor = { item: out.item, count: out.count };
        this.state.output = null;
      } else if (this.cursor.item === out.item) {
        const available = itemMaxStack(out.item) - this.cursor.count;
        if (available >= out.count) {
          // Cursor has room for the entire output stack — merge it in.
          this.cursor = { item: this.cursor.item, count: this.cursor.count + out.count };
          this.state.output = null;
        }
        // else: cursor full or different item — no-op (do not swap into output).
      }
      // cursor holds a different item: no-op.
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

    this.refresh();
  }

  refresh(): void {
    // Paint all 36 inventory slots
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const el = this.slotEls[i];
      if (el === undefined) continue;
      this.paintTile(el, this.inventory.getSlot(i));
    }

    // Paint the 3 furnace slots (read from live state if bound, else show empty)
    this.paintTile(this.furnaceInputEl,  this.state !== null ? this.state.input  : null);
    this.paintTile(this.furnaceFuelEl,   this.state !== null ? this.state.fuel   : null);
    this.paintTile(this.furnaceOutputEl, this.state !== null ? this.state.output : null);

    // Update flame gauge: bottom-anchored orange fill, height = burn ratio.
    const flameRatio = (this.state !== null && this.state.burnTimeTotal > 0)
      ? Math.max(0, Math.min(1, this.state.burnTimeRemaining / this.state.burnTimeTotal))
      : 0;
    this.flameGaugeFillEl.style.height = Math.round(flameRatio * 100) + '%';

    // Update progress arrow: left-to-right green fill, width = cook ratio.
    const cookRatio = this.state !== null
      ? Math.max(0, Math.min(1, this.state.cookProgress / SMELT_DURATION_S))
      : 0;
    this.progressArrowFillEl.style.width = Math.round(cookRatio * 100) + '%';

    this.updateCursorEl();
  }

  open(state: FurnaceState): void {
    this.state = state;
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.refresh();
    window.addEventListener('mousemove', this.onMouseMove);
  }

  close(): void {
    // Return any cursor-held stack to the player inventory (conservation invariant).
    // Do NOT touch the 3 furnace slots — they belong to the furnace's FurnaceState.
    if (this.cursor !== null) {
      const heldItem = this.cursor.item;
      const leftover = this.inventory.add(this.cursor.item, this.cursor.count);
      if (leftover > 0) {
        if (this.onSpill !== null) {
          this.onSpill(heldItem, leftover);
        } else {
          console.error(`[FurnaceScreen] close() could not return ${leftover} held item(s) — inventory full`);
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
  }
}
