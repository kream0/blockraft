import { ensureMenuStyles } from './styles';

export abstract class MenuScreen {
  protected root: HTMLElement;

  /** Append all DOM into this.root. The root is appended to `parent` on construction.
   *  Subclasses must call `this.build()` themselves AFTER their fields are initialized. */
  constructor(parent: HTMLElement) {
    ensureMenuStyles();
    this.root = document.createElement('div');
    this.root.className = 'mc-menu';
    parent.appendChild(this.root);
  }

  /** Subclass: build DOM into this.root. */
  protected abstract build(): void;

  /** Remove root from DOM. Override and call super to add cleanup. */
  dispose(): void {
    if (this.root.parentNode !== null) this.root.parentNode.removeChild(this.root);
  }
}
