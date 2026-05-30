import { SETTINGS_RANGES, KEYBINDABLE_ACTIONS, type Settings, type Keybindings, type KeyBindableAction } from '../../types';
import { MenuScreen } from './MenuScreen';

export interface SettingsMenuCallbacks {
  /** Called on every input change. */
  onChange(settings: Settings): void;
  onDone(): void;
  /** Optional reset-to-defaults handler. App handles persisting + applying. */
  onResetDefaults(): void;
}

interface SliderRow {
  input: HTMLInputElement;
  valueLabel: HTMLElement;
  format: (value: number) => string;
}

interface CheckboxRow {
  input: HTMLInputElement;
}

type NumericKey = keyof typeof SETTINGS_RANGES;
type BooleanKey = 'invertY' | 'showFps';

const NUMERIC_KEYS: readonly NumericKey[] = [
  'renderDistance',
  'fov',
  'mouseSensitivity',
  'masterVolume',
  'musicVolume',
  'sfxVolume',
];

const BOOLEAN_KEYS: readonly BooleanKey[] = ['invertY', 'showFps'];

const NUMERIC_LABELS: Record<NumericKey, string> = {
  renderDistance: 'Render Distance',
  fov: 'FOV',
  mouseSensitivity: 'Mouse Sensitivity',
  masterVolume: 'Master Volume',
  musicVolume: 'Music Volume',
  sfxVolume: 'SFX Volume',
};

const BOOLEAN_LABELS: Record<BooleanKey, string> = {
  invertY: 'Invert Y Axis',
  showFps: 'Show FPS',
};

/** Codes reserved for fixed handlers (hotbar slots) — not rebindable in v1. */
const RESERVED_KEY_CODES: ReadonlySet<string> = new Set([
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8', 'Digit9',
]);

const KEYBINDING_LABELS: Record<KeyBindableAction, string> = {
  forward: 'Move Forward',
  back: 'Move Back',
  left: 'Strafe Left',
  right: 'Strafe Right',
  jump: 'Jump',
  sprint: 'Sprint',
  inventory: 'Open Inventory',
};

/** Human-friendly label for a KeyboardEvent.code. */
function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);        // KeyW -> W
  if (code.startsWith('Digit')) return code.slice(5);      // Digit1 -> 1
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  switch (code) {
    case 'Space': return 'Space';
    case 'ShiftLeft': return 'Left Shift';
    case 'ShiftRight': return 'Right Shift';
    case 'ControlLeft': return 'Left Ctrl';
    case 'ControlRight': return 'Right Ctrl';
    case 'AltLeft': return 'Left Alt';
    case 'AltRight': return 'Right Alt';
    case 'ArrowUp': return 'Up Arrow';
    case 'ArrowDown': return 'Down Arrow';
    case 'ArrowLeft': return 'Left Arrow';
    case 'ArrowRight': return 'Right Arrow';
    case 'Enter': return 'Enter';
    case 'Tab': return 'Tab';
    case 'Backspace': return 'Backspace';
    default: return code;
  }
}

function formatChunks(value: number): string {
  return `${value} chunks`;
}

function formatInt(value: number): string {
  return `${Math.round(value)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSensitivity(value: number): string {
  return `${value.toFixed(2)}x`;
}

const VALUE_FORMATTERS: Record<NumericKey, (value: number) => string> = {
  renderDistance: formatChunks,
  fov: formatInt,
  mouseSensitivity: formatSensitivity,
  masterVolume: formatPercent,
  musicVolume: formatPercent,
  sfxVolume: formatPercent,
};

export class SettingsMenu extends MenuScreen {
  private readonly callbacks: SettingsMenuCallbacks;
  private current: Settings;

  private sliders: Partial<Record<NumericKey, SliderRow>> = {};
  private checkboxes: Partial<Record<BooleanKey, CheckboxRow>> = {};
  private bindingButtons: Partial<Record<KeyBindableAction, HTMLButtonElement>> = {};
  private listeningAction: KeyBindableAction | null = null;
  private keyCaptureHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(parent: HTMLElement, initial: Settings, callbacks: SettingsMenuCallbacks) {
    super(parent);
    this.callbacks = callbacks;
    this.current = { ...initial };
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();
    this.cancelListening();
    this.sliders = {};
    this.checkboxes = {};
    this.bindingButtons = {};

    const title = document.createElement('div');
    title.className = 'mc-menu-title';
    title.textContent = 'Options';
    this.root.appendChild(title);

    const list = document.createElement('div');
    list.className = 'mc-settings-list';

    for (const key of NUMERIC_KEYS) {
      list.appendChild(this.makeSliderRow(key));
    }
    for (const key of BOOLEAN_KEYS) {
      list.appendChild(this.makeCheckboxRow(key));
    }

    this.root.appendChild(list);

    const kbTitle = document.createElement('div');
    kbTitle.className = 'mc-settings-subtitle';
    kbTitle.textContent = 'Controls';
    this.root.appendChild(kbTitle);

    const kbList = document.createElement('div');
    kbList.className = 'mc-settings-list';
    for (const action of KEYBINDABLE_ACTIONS) {
      kbList.appendChild(this.makeBindingRow(action));
    }
    this.root.appendChild(kbList);

    const panel = document.createElement('div');
    panel.className = 'mc-menu-panel';

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'mc-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => this.callbacks.onDone());

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'mc-btn';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.addEventListener('click', () => this.callbacks.onResetDefaults());

    panel.appendChild(doneBtn);
    panel.appendChild(resetBtn);
    this.root.appendChild(panel);
  }

  private makeSliderRow(key: NumericKey): HTMLElement {
    const row = document.createElement('div');
    row.className = 'mc-form-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'mc-setting-label-row';

    const label = document.createElement('label');
    label.textContent = NUMERIC_LABELS[key];

    const valueLabel = document.createElement('span');
    valueLabel.className = 'mc-setting-value';

    labelRow.appendChild(label);
    labelRow.appendChild(valueLabel);
    row.appendChild(labelRow);

    const range = SETTINGS_RANGES[key];
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'mc-slider';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    const initialValue = this.current[key];
    input.value = String(initialValue);

    const format = VALUE_FORMATTERS[key];
    valueLabel.textContent = format(initialValue);

    input.addEventListener('input', () => {
      const v = input.valueAsNumber;
      if (Number.isNaN(v)) return;
      this.current = { ...this.current, [key]: v };
      valueLabel.textContent = format(v);
      this.callbacks.onChange(this.current);
    });

    row.appendChild(input);
    this.sliders[key] = { input, valueLabel, format };
    return row;
  }

  private makeCheckboxRow(key: BooleanKey): HTMLElement {
    const row = document.createElement('div');
    row.className = 'mc-checkbox-row';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `mc-setting-${key}`;
    input.checked = this.current[key];

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = BOOLEAN_LABELS[key];

    input.addEventListener('change', () => {
      this.current = { ...this.current, [key]: input.checked };
      this.callbacks.onChange(this.current);
    });

    row.appendChild(input);
    row.appendChild(label);

    this.checkboxes[key] = { input };
    return row;
  }

  private makeBindingRow(action: KeyBindableAction): HTMLElement {
    const row = document.createElement('div');
    row.className = 'mc-form-row mc-keybind-row';

    const label = document.createElement('label');
    label.className = 'mc-keybind-label';
    label.textContent = KEYBINDING_LABELS[action];

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-btn mc-keybind-btn';
    btn.textContent = formatKeyCode(this.current.keybindings[action]);
    btn.addEventListener('click', () => this.beginListening(action));

    row.appendChild(label);
    row.appendChild(btn);
    this.bindingButtons[action] = btn;
    return row;
  }

  private beginListening(action: KeyBindableAction): void {
    this.cancelListening(); // only one at a time
    this.listeningAction = action;
    const btn = this.bindingButtons[action];
    if (btn !== undefined) {
      btn.textContent = '> Press a key <';
      btn.classList.add('mc-keybind-listening');
    }
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation(); // don't leak the key to the game or other menu handlers
      if (e.code === 'Escape' || RESERVED_KEY_CODES.has(e.code)) {
        this.cancelListening(); // reserved/cancel → revert to current binding
        return;
      }
      this.assignBinding(action, e.code);
      this.cancelListening();
    };
    this.keyCaptureHandler = handler;
    window.addEventListener('keydown', handler, true); // capture phase
  }

  private cancelListening(): void {
    if (this.keyCaptureHandler !== null) {
      window.removeEventListener('keydown', this.keyCaptureHandler, true);
      this.keyCaptureHandler = null;
    }
    const action = this.listeningAction;
    this.listeningAction = null;
    if (action !== null) {
      const btn = this.bindingButtons[action];
      if (btn !== undefined) {
        btn.classList.remove('mc-keybind-listening');
        btn.textContent = formatKeyCode(this.current.keybindings[action]);
      }
    }
  }

  /** Assign `code` to `action`, swapping with any action that already used it (no dupes, none empty). */
  private assignBinding(action: KeyBindableAction, code: string): void {
    const oldCode = this.current.keybindings[action];
    if (oldCode === code) return;
    const next: Keybindings = { ...this.current.keybindings };
    for (const other of KEYBINDABLE_ACTIONS) {
      if (other !== action && next[other] === code) {
        next[other] = oldCode; // swap: the conflicting action inherits our old key
      }
    }
    next[action] = code;
    this.current = { ...this.current, keybindings: next };
    this.refreshBindingLabels();
    this.callbacks.onChange(this.current);
  }

  private refreshBindingLabels(): void {
    for (const action of KEYBINDABLE_ACTIONS) {
      const btn = this.bindingButtons[action];
      if (btn === undefined) continue;
      btn.textContent = formatKeyCode(this.current.keybindings[action]);
    }
  }

  /** Update displayed values without firing onChange. */
  setValues(settings: Settings): void {
    this.cancelListening();
    this.current = { ...settings };
    for (const key of NUMERIC_KEYS) {
      const slider = this.sliders[key];
      if (slider === undefined) continue;
      const v = settings[key];
      slider.input.value = String(v);
      slider.valueLabel.textContent = slider.format(v);
    }
    for (const key of BOOLEAN_KEYS) {
      const cb = this.checkboxes[key];
      if (cb === undefined) continue;
      cb.input.checked = settings[key];
    }
    this.refreshBindingLabels();
  }

  override dispose(): void {
    this.cancelListening();
    super.dispose();
  }
}
