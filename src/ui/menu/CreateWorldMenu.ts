import { GameMode, type GameMode as GameModeT } from '../../types';
import { MenuScreen } from './MenuScreen';

export interface CreateWorldData {
  name: string;
  seed: string;
  gameMode: GameModeT;
}

export interface CreateWorldMenuCallbacks {
  onCreate(data: CreateWorldData): void;
  onCancel(): void;
}

export class CreateWorldMenu extends MenuScreen {
  private readonly callbacks: CreateWorldMenuCallbacks;
  private readonly existingNames: ReadonlySet<string>;

  private nameInput: HTMLInputElement | null = null;
  private seedInput: HTMLInputElement | null = null;
  private modeSelect: HTMLSelectElement | null = null;
  private createBtn: HTMLButtonElement | null = null;
  private errorEl: HTMLElement | null = null;

  constructor(
    parent: HTMLElement,
    existingNames: string[],
    callbacks: CreateWorldMenuCallbacks,
  ) {
    super(parent);
    this.callbacks = callbacks;
    this.existingNames = new Set(existingNames);
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();

    const title = document.createElement('div');
    title.className = 'mc-menu-title';
    title.textContent = 'Create New World';
    this.root.appendChild(title);

    const panel = document.createElement('div');
    panel.className = 'mc-menu-panel';

    // Name field
    const nameRow = document.createElement('div');
    nameRow.className = 'mc-form-row';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'World Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'mc-input';
    nameInput.placeholder = 'My World';
    nameInput.maxLength = 64;
    const nameError = document.createElement('div');
    nameError.className = 'mc-error';
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    nameRow.appendChild(nameError);
    panel.appendChild(nameRow);

    // Seed field
    const seedRow = document.createElement('div');
    seedRow.className = 'mc-form-row';
    const seedLabel = document.createElement('label');
    seedLabel.textContent = 'Seed';
    const seedInput = document.createElement('input');
    seedInput.type = 'text';
    seedInput.className = 'mc-input';
    seedInput.placeholder = '(optional)';
    seedInput.maxLength = 64;
    const seedHelper = document.createElement('div');
    seedHelper.className = 'mc-form-helper';
    seedHelper.textContent = 'Leave empty for random based on name.';
    seedRow.appendChild(seedLabel);
    seedRow.appendChild(seedInput);
    seedRow.appendChild(seedHelper);
    panel.appendChild(seedRow);

    // Game mode field
    const modeRow = document.createElement('div');
    modeRow.className = 'mc-form-row';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Game Mode';
    const modeSelect = document.createElement('select');
    modeSelect.className = 'mc-select';
    const survivalOpt = document.createElement('option');
    survivalOpt.value = GameMode.SURVIVAL;
    survivalOpt.textContent = 'Survival';
    const creativeOpt = document.createElement('option');
    creativeOpt.value = GameMode.CREATIVE;
    creativeOpt.textContent = 'Creative';
    modeSelect.appendChild(survivalOpt);
    modeSelect.appendChild(creativeOpt);
    modeSelect.value = GameMode.SURVIVAL;
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeSelect);
    panel.appendChild(modeRow);

    // Buttons
    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'mc-btn';
    createBtn.textContent = 'Create';
    createBtn.disabled = true;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'mc-btn';
    cancelBtn.textContent = 'Cancel';

    panel.appendChild(createBtn);
    panel.appendChild(cancelBtn);

    this.root.appendChild(panel);

    this.nameInput = nameInput;
    this.seedInput = seedInput;
    this.modeSelect = modeSelect;
    this.createBtn = createBtn;
    this.errorEl = nameError;

    nameInput.addEventListener('input', () => this.validate());

    createBtn.addEventListener('click', () => this.tryCreate());
    cancelBtn.addEventListener('click', () => this.callbacks.onCancel());

    nameInput.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' && !createBtn.disabled) {
        ev.preventDefault();
        this.tryCreate();
      }
    });

    this.validate();
  }

  private validate(): void {
    const nameInput = this.nameInput;
    const errorEl = this.errorEl;
    const createBtn = this.createBtn;
    if (nameInput === null || errorEl === null || createBtn === null) return;

    const trimmed = nameInput.value.trim();
    if (trimmed.length === 0) {
      errorEl.textContent = '';
      createBtn.disabled = true;
      return;
    }
    if (this.existingNames.has(trimmed)) {
      errorEl.textContent = 'World already exists';
      createBtn.disabled = true;
      return;
    }
    errorEl.textContent = '';
    createBtn.disabled = false;
  }

  private tryCreate(): void {
    const nameInput = this.nameInput;
    const seedInput = this.seedInput;
    const modeSelect = this.modeSelect;
    if (nameInput === null || seedInput === null || modeSelect === null) return;

    const name = nameInput.value.trim();
    if (name.length === 0 || this.existingNames.has(name)) return;

    const seed = seedInput.value.trim();
    const modeValue = modeSelect.value;
    const gameMode: GameModeT =
      modeValue === GameMode.CREATIVE ? GameMode.CREATIVE : GameMode.SURVIVAL;

    this.callbacks.onCreate({ name, seed, gameMode });
  }
}
