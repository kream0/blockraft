import { SETTINGS_RANGES, type Settings } from '../../types';
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

  constructor(parent: HTMLElement, initial: Settings, callbacks: SettingsMenuCallbacks) {
    super(parent);
    this.callbacks = callbacks;
    this.current = { ...initial };
    this.build();
  }

  protected override build(): void {
    this.root.replaceChildren();
    this.sliders = {};
    this.checkboxes = {};

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

  /** Update displayed values without firing onChange. */
  setValues(settings: Settings): void {
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
  }
}
