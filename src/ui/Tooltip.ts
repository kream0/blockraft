import { type ItemId } from '../types';
import { getItemDef, isBlockItem } from '../items/ItemRegistry';

/** Human-readable item name. Block items have ALL_CAPS enum keys ("COAL_ORE") — prettify to "Coal Ore". */
export function itemDisplayName(id: ItemId): string {
  const raw = getItemDef(id).name;
  if (!isBlockItem(id)) return raw;
  return raw.toLowerCase().split('_').map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

export class Tooltip {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'z-index:70',
      'pointer-events:none',
      'background:rgba(20,20,20,0.95)',
      'color:#fff',
      'font-family:monospace',
      'font-size:12px',
      'padding:4px 8px',
      'border:1px solid #555',
      'border-radius:3px',
      'white-space:nowrap',
      'box-shadow:0 2px 6px rgba(0,0,0,0.5)',
      'display:none',
    ].join(';');
    container.appendChild(el);
    this.el = el;
  }

  show(text: string, clientX: number, clientY: number): void {
    this.el.textContent = text;
    this.el.style.display = 'block';

    // Initial position with offset from cursor
    let left = clientX + 14;
    let top = clientY + 18;

    // Force a reflow so offsetWidth/offsetHeight are up to date
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;

    // Clamp: if overflow right, flip to left of cursor
    if (left + w > window.innerWidth) {
      left = clientX - w - 6;
    }
    // Clamp: if overflow bottom, flip above cursor
    if (top + h > window.innerHeight) {
      top = clientY - h - 6;
    }

    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  dispose(): void {
    if (this.el.parentNode !== null) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
