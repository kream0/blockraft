import { MenuScreen } from './MenuScreen';

export interface MainMenuCallbacks {
  onSingleplayer(): void;
  onMultiplayer(): void;
  onSettings(): void;
  onQuit(): void;
}

export class MainMenu extends MenuScreen {
  private readonly callbacks: MainMenuCallbacks;

  constructor(parent: HTMLElement, callbacks: MainMenuCallbacks) {
    super(parent);
    this.callbacks = callbacks;
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();

    const title = document.createElement('div');
    title.className = 'mc-menu-title';
    title.textContent = 'Minecraft Clone';
    this.root.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'mc-menu-subtitle';
    subtitle.textContent = 'A Claude Code Project';
    this.root.appendChild(subtitle);

    const panel = document.createElement('div');
    panel.className = 'mc-menu-panel';

    panel.appendChild(this.makeButton('Singleplayer', () => this.callbacks.onSingleplayer()));
    panel.appendChild(this.makeButton('Multiplayer', () => this.callbacks.onMultiplayer()));
    panel.appendChild(this.makeButton('Settings', () => this.callbacks.onSettings()));
    panel.appendChild(this.makeButton('Quit', () => this.callbacks.onQuit()));

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
