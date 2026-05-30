import type { WorldMetadata } from '../../types';
import { MenuScreen } from './MenuScreen';

export interface WorldsMenuCallbacks {
  onCreate(): void;
  onLoad(name: string): void;
  onDelete(name: string): void;
  onExport(name: string): void;
  onImport(): void;
  onBack(): void;
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' });

function formatLastPlayed(epochMs: number, now: number = Date.now()): string {
  const delta = now - epochMs;
  if (delta < 0) return DATE_FMT.format(new Date(epochMs));
  const day = 24 * 60 * 60 * 1000;
  if (delta < day) {
    const hours = Math.floor(delta / (60 * 60 * 1000));
    if (hours <= 0) {
      const minutes = Math.max(1, Math.floor(delta / (60 * 1000)));
      return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    }
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  return DATE_FMT.format(new Date(epochMs));
}

export class WorldsMenu extends MenuScreen {
  private readonly callbacks: WorldsMenuCallbacks;
  private readonly worlds: WorldMetadata[];

  constructor(parent: HTMLElement, worlds: WorldMetadata[], callbacks: WorldsMenuCallbacks) {
    super(parent);
    this.callbacks = callbacks;
    this.worlds = worlds.slice();
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();

    const title = document.createElement('div');
    title.className = 'mc-menu-title';
    title.textContent = 'Select World';
    this.root.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'mc-menu-subtitle';
    const count = this.worlds.length;
    subtitle.textContent = count === 1 ? '1 world' : `${count} worlds`;
    this.root.appendChild(subtitle);

    if (this.worlds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mc-world-empty';
      empty.textContent = 'No worlds yet — click Create New World.';
      this.root.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'mc-worlds-list';
      for (const meta of this.worlds) {
        list.appendChild(this.makeWorldItem(meta));
      }
      this.root.appendChild(list);
    }

    const panel = document.createElement('div');
    panel.className = 'mc-menu-panel';
    panel.appendChild(this.makeButton('Create New World', () => this.callbacks.onCreate()));
    panel.appendChild(this.makeButton('Import World', () => this.callbacks.onImport()));
    panel.appendChild(this.makeButton('Back', () => this.callbacks.onBack()));
    this.root.appendChild(panel);
  }

  private makeWorldItem(meta: WorldMetadata): HTMLElement {
    const item = document.createElement('div');
    item.className = 'mc-world-item';

    const name = document.createElement('div');
    name.className = 'mc-world-name';
    name.textContent = meta.name;
    item.appendChild(name);

    const lastPlayed = document.createElement('div');
    lastPlayed.className = 'mc-world-meta';
    lastPlayed.textContent = 'Last played: ' + formatLastPlayed(meta.lastPlayed);
    item.appendChild(lastPlayed);

    const mode = document.createElement('div');
    mode.className = 'mc-world-meta';
    mode.textContent = 'Mode: ' + meta.gameMode;
    item.appendChild(mode);

    const seed = document.createElement('div');
    seed.className = 'mc-world-meta';
    seed.textContent = 'Seed: ' + String(meta.seed);
    item.appendChild(seed);

    const actions = document.createElement('div');
    actions.className = 'mc-world-actions';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'mc-btn mc-btn-small';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      this.callbacks.onLoad(meta.name);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'mc-btn mc-btn-small mc-btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      this.replaceWithConfirm(item, meta.name);
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'mc-btn mc-btn-small';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      this.callbacks.onExport(meta.name);
    });

    actions.appendChild(loadBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);

    return item;
  }

  private replaceWithConfirm(item: HTMLElement, worldName: string): void {
    const confirm = document.createElement('div');
    confirm.className = 'mc-confirm-row';

    const text = document.createElement('div');
    text.className = 'mc-confirm-text';
    text.textContent = `Delete ${worldName}?`;

    const actions = document.createElement('div');
    actions.className = 'mc-world-actions';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'mc-btn mc-btn-small mc-btn-danger';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      this.callbacks.onDelete(worldName);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'mc-btn mc-btn-small';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      const parent = confirm.parentNode;
      if (parent !== null) parent.replaceChild(item, confirm);
    });

    actions.appendChild(yesBtn);
    actions.appendChild(cancelBtn);
    confirm.appendChild(text);
    confirm.appendChild(actions);

    const parent = item.parentNode;
    if (parent !== null) parent.replaceChild(confirm, item);
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
