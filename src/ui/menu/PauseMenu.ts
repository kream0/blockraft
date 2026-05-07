import { MenuScreen } from './MenuScreen';

export interface PauseMenuCallbacks {
  onResume(): void;
  onSettings(): void;
  onQuitToMenu(): void;
}

export class PauseMenu extends MenuScreen {
  private readonly callbacks: PauseMenuCallbacks;

  constructor(parent: HTMLElement, callbacks: PauseMenuCallbacks) {
    super(parent);
    this.callbacks = callbacks;
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();
    // Less opaque so the game peeks through.
    this.root.style.background = 'rgba(0,0,0,0.6)';

    const title = document.createElement('div');
    title.className = 'mc-menu-title';
    title.textContent = 'Game Paused';
    this.root.appendChild(title);

    const panel = document.createElement('div');
    panel.className = 'mc-menu-panel';

    panel.appendChild(this.makeButton('Resume', () => this.callbacks.onResume()));
    panel.appendChild(this.makeButton('Settings', () => this.callbacks.onSettings()));
    panel.appendChild(this.makeButton('Save and Quit to Menu', () => this.callbacks.onQuitToMenu()));

    this.root.appendChild(panel);
  }

  private makeButton(label: string, handler: (ev: MouseEvent) => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-btn';
    btn.textContent = label;
    btn.addEventListener('click', handler);
    return btn;
  }
}
