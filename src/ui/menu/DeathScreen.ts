import { MenuScreen } from './MenuScreen';

export interface DeathScreenCallbacks {
  onRespawn(): void;
  onQuitToMenu(): void;
}

export class DeathScreen extends MenuScreen {
  private readonly callbacks: DeathScreenCallbacks;

  constructor(parent: HTMLElement, callbacks: DeathScreenCallbacks) {
    super(parent);
    this.callbacks = callbacks;
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();
    // Red-tinted darker backdrop to sell the death moment.
    this.root.style.background = 'rgba(40,0,0,0.78)';

    const title = document.createElement('div');
    title.className = 'mc-menu-title';
    title.textContent = 'You Died';
    title.style.color = '#ff5555';
    this.root.appendChild(title);

    const panel = document.createElement('div');
    panel.className = 'mc-menu-panel';

    panel.appendChild(this.makeButton('Respawn', () => this.callbacks.onRespawn()));
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
