import {
  SETTINGS_RANGES,
  KEYBINDABLE_ACTIONS,
  DEFAULT_SETTINGS,
  GRAPHICS_PRESETS,
  SHADOW_MAP_SIZES,
  SSAO_SAMPLE_COUNTS,
  ATLAS_TILE_SIZES,
  ANISOTROPY_LEVELS,
  GraphicsQuality,
  AntiAlias,
  ShadowSoftness,
  EdgeRounding,
  ToneMapping,
  FogType,
  WaterQuality,
  CloudDetail,
  type Settings,
  type Keybindings,
  type KeyBindableAction,
} from '../../types';
import { MenuScreen } from './MenuScreen';

// Concrete-fallback accessor — optional graphics fields read as T (not T | undefined).
const DEFAULTS = DEFAULT_SETTINGS as Required<Settings>;

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
  pixelRatioCap: 'Pixel Ratio Cap',
  ssaoIntensity: 'SSAO Intensity',
  bloomIntensity: 'Bloom Intensity',
  bloomThreshold: 'Bloom Threshold',
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
  pixelRatioCap: (v) => `${v.toFixed(2)}x`,
  ssaoIntensity: (v) => v.toFixed(1),
  bloomIntensity: (v) => v.toFixed(2),
  bloomThreshold: (v) => v.toFixed(2),
};

/** Keys for the 4 graphics-only sliders rendered inside the Advanced panel. */
const GRAPHICS_SLIDER_KEYS: readonly NumericKey[] = [
  'pixelRatioCap',
  'ssaoIntensity',
  'bloomIntensity',
  'bloomThreshold',
];

export class SettingsMenu extends MenuScreen {
  private readonly callbacks: SettingsMenuCallbacks;
  private current: Settings;

  private sliders: Partial<Record<NumericKey, SliderRow>> = {};
  private checkboxes: Partial<Record<BooleanKey, CheckboxRow>> = {};
  private bindingButtons: Partial<Record<KeyBindableAction, HTMLButtonElement>> = {};
  private listeningAction: KeyBindableAction | null = null;
  private keyCaptureHandler: ((e: KeyboardEvent) => void) | null = null;
  private presetSelect: HTMLSelectElement | null = null;
  private graphicsRefreshers: Array<(s: Settings) => void> = [];

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
    this.graphicsRefreshers = [];
    this.presetSelect = null;

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

    // ── Graphics section ──────────────────────────────────────────────────────
    const gfxTitle = document.createElement('div');
    gfxTitle.className = 'mc-settings-subtitle';
    gfxTitle.textContent = 'Graphics';
    this.root.appendChild(gfxTitle);

    const gfxList = document.createElement('div');
    gfxList.className = 'mc-settings-list';

    // Preset row
    const presetOptions: ReadonlyArray<{ value: string; label: string }> = [
      { value: 'low',    label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high',   label: 'High' },
      { value: 'ultra',  label: 'Ultra' },
      { value: 'custom', label: 'Custom' },
    ];
    const { row: presetRow, select: presetSel } = this.makeSelectRow(
      'Quality Preset',
      presetOptions,
      this.current.graphicsQuality ?? DEFAULTS.graphicsQuality,
      (value) => {
        if (value === 'custom') {
          this.current = { ...this.current, graphicsQuality: GraphicsQuality.CUSTOM };
          this.callbacks.onChange(this.current);
        } else {
          this.applyPreset(value as Exclude<GraphicsQuality, 'custom'>);
        }
      },
    );
    this.presetSelect = presetSel;
    gfxList.appendChild(presetRow);

    // Advanced group
    const details = document.createElement('details');
    details.className = 'mc-graphics-advanced';
    details.open = (this.current.graphicsQuality === GraphicsQuality.CUSTOM);

    const summary = document.createElement('summary');
    summary.textContent = 'Advanced / Custom';
    details.appendChild(summary);

    // ── Enum selects ────────────────────────────────────────────────────────
    // 1. Anti-aliasing
    const { row: aaRow, select: aaSel } = this.makeSelectRow(
      'Anti-aliasing',
      [
        { value: AntiAlias.OFF,  label: 'Off' },
        { value: AntiAlias.FXAA, label: 'FXAA' },
        { value: AntiAlias.SMAA, label: 'SMAA' },
      ],
      this.current.antiAlias ?? DEFAULTS.antiAlias,
      (value) => {
        this.current = { ...this.current, antiAlias: value as AntiAlias };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { aaSel.value = s.antiAlias ?? DEFAULTS.antiAlias; });
    details.appendChild(aaRow);

    // 2. Shadow Softness
    const { row: ssRow, select: ssSel } = this.makeSelectRow(
      'Shadow Softness',
      [
        { value: ShadowSoftness.PCF,      label: 'PCF' },
        { value: ShadowSoftness.PCF_SOFT, label: 'PCF Soft' },
      ],
      this.current.shadowSoftness ?? DEFAULTS.shadowSoftness,
      (value) => {
        this.current = { ...this.current, shadowSoftness: value as ShadowSoftness };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { ssSel.value = s.shadowSoftness ?? DEFAULTS.shadowSoftness; });
    details.appendChild(ssRow);

    // 3. Edge Rounding
    const { row: erRow, select: erSel } = this.makeSelectRow(
      'Edge Rounding',
      [
        { value: EdgeRounding.OFF,       label: 'Off' },
        { value: EdgeRounding.ANALYTIC,  label: 'Analytic' },
        { value: EdgeRounding.NORMALMAP, label: 'Normal Map' },
      ],
      this.current.edgeRounding ?? DEFAULTS.edgeRounding,
      (value) => {
        this.current = { ...this.current, edgeRounding: value as EdgeRounding };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { erSel.value = s.edgeRounding ?? DEFAULTS.edgeRounding; });
    details.appendChild(erRow);

    // 4. Tone Mapping
    const { row: tmRow, select: tmSel } = this.makeSelectRow(
      'Tone Mapping',
      [
        { value: ToneMapping.NONE,   label: 'None' },
        { value: ToneMapping.LINEAR, label: 'Linear' },
        { value: ToneMapping.ACES,   label: 'ACES' },
      ],
      this.current.toneMapping ?? DEFAULTS.toneMapping,
      (value) => {
        this.current = { ...this.current, toneMapping: value as ToneMapping };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { tmSel.value = s.toneMapping ?? DEFAULTS.toneMapping; });
    details.appendChild(tmRow);

    // 5. Fog Type
    const { row: ftRow, select: ftSel } = this.makeSelectRow(
      'Fog Type',
      [
        { value: FogType.LINEAR, label: 'Linear' },
        { value: FogType.EXP2,   label: 'Exponential²' },
      ],
      this.current.fogType ?? DEFAULTS.fogType,
      (value) => {
        this.current = { ...this.current, fogType: value as FogType };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { ftSel.value = s.fogType ?? DEFAULTS.fogType; });
    details.appendChild(ftRow);

    // 6. Water Quality
    const { row: wqRow, select: wqSel } = this.makeSelectRow(
      'Water Quality',
      [
        { value: WaterQuality.BASIC,       label: 'Basic' },
        { value: WaterQuality.ANIMATED,    label: 'Animated' },
        { value: WaterQuality.REFLECTIVE,  label: 'Reflective' },
      ],
      this.current.waterQuality ?? DEFAULTS.waterQuality,
      (value) => {
        this.current = { ...this.current, waterQuality: value as WaterQuality };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { wqSel.value = s.waterQuality ?? DEFAULTS.waterQuality; });
    details.appendChild(wqRow);

    // 7. Cloud Detail
    const { row: cdRow, select: cdSel } = this.makeSelectRow(
      'Cloud Detail',
      [
        { value: CloudDetail.LOW,    label: 'Low' },
        { value: CloudDetail.MEDIUM, label: 'Medium' },
        { value: CloudDetail.HIGH,   label: 'High' },
        { value: CloudDetail.ULTRA,  label: 'Ultra' },
      ],
      this.current.cloudDetail ?? DEFAULTS.cloudDetail,
      (value) => {
        this.current = { ...this.current, cloudDetail: value as CloudDetail };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { cdSel.value = s.cloudDetail ?? DEFAULTS.cloudDetail; });
    details.appendChild(cdRow);

    // ── Numeric selects ─────────────────────────────────────────────────────
    // 8. Shadow Map Size
    const { row: smRow, select: smSel } = this.makeSelectRow(
      'Shadow Map Size',
      SHADOW_MAP_SIZES.map((n) => ({ value: String(n), label: n === 0 ? 'Off' : String(n) })),
      String(this.current.shadowMapSize ?? DEFAULTS.shadowMapSize),
      (value) => {
        this.current = { ...this.current, shadowMapSize: Number(value) };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { smSel.value = String(s.shadowMapSize ?? DEFAULTS.shadowMapSize); });
    details.appendChild(smRow);

    // 9. SSAO Samples
    const { row: sampRow, select: sampSel } = this.makeSelectRow(
      'SSAO Samples',
      SSAO_SAMPLE_COUNTS.map((n) => ({ value: String(n), label: String(n) })),
      String(this.current.ssaoSamples ?? DEFAULTS.ssaoSamples),
      (value) => {
        this.current = { ...this.current, ssaoSamples: Number(value) };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { sampSel.value = String(s.ssaoSamples ?? DEFAULTS.ssaoSamples); });
    details.appendChild(sampRow);

    // 10. Atlas Tile Size
    const { row: atRow, select: atSel } = this.makeSelectRow(
      'Atlas Tile Size',
      ATLAS_TILE_SIZES.map((n) => ({ value: String(n), label: `${n}px` })),
      String(this.current.atlasTileSize ?? DEFAULTS.atlasTileSize),
      (value) => {
        this.current = { ...this.current, atlasTileSize: Number(value) };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { atSel.value = String(s.atlasTileSize ?? DEFAULTS.atlasTileSize); });
    details.appendChild(atRow);

    // 11. Anisotropy
    const { row: aniRow, select: aniSel } = this.makeSelectRow(
      'Anisotropy',
      ANISOTROPY_LEVELS.map((n) => ({ value: String(n), label: n === 0 ? 'Max' : `${n}x` })),
      String(this.current.anisotropy ?? DEFAULTS.anisotropy),
      (value) => {
        this.current = { ...this.current, anisotropy: Number(value) };
        this.markCustom();
        this.callbacks.onChange(this.current);
      },
    );
    this.graphicsRefreshers.push((s) => { aniSel.value = String(s.anisotropy ?? DEFAULTS.anisotropy); });
    details.appendChild(aniRow);

    // ── Graphics sliders ────────────────────────────────────────────────────
    details.appendChild(this.makeSliderRow('pixelRatioCap', () => this.markCustom()));
    details.appendChild(this.makeSliderRow('ssaoIntensity',  () => this.markCustom()));
    details.appendChild(this.makeSliderRow('bloomIntensity', () => this.markCustom()));
    details.appendChild(this.makeSliderRow('bloomThreshold', () => this.markCustom()));

    // ── Graphics checkboxes ─────────────────────────────────────────────────
    details.appendChild(this.makeGraphicsCheckboxRow('ssao',       'SSAO'));
    details.appendChild(this.makeGraphicsCheckboxRow('normalMaps', 'Normal Maps'));
    details.appendChild(this.makeGraphicsCheckboxRow('bloom',      'Bloom'));

    gfxList.appendChild(details);
    this.root.appendChild(gfxList);
    // ── End Graphics section ─────────────────────────────────────────────────

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

  private makeSliderRow(key: NumericKey, onEdit?: () => void): HTMLElement {
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
    const initialValue = this.current[key] ?? DEFAULTS[key];
    input.value = String(initialValue);

    const format = VALUE_FORMATTERS[key];
    valueLabel.textContent = format(initialValue);

    input.addEventListener('input', () => {
      const v = input.valueAsNumber;
      if (Number.isNaN(v)) return;
      this.current = { ...this.current, [key]: v };
      valueLabel.textContent = format(v);
      onEdit?.();
      this.callbacks.onChange(this.current);
    });

    row.appendChild(input);
    this.sliders[key] = { input, valueLabel, format };
    return row;
  }

  private makeSelectRow(
    labelText: string,
    options: ReadonlyArray<{ value: string; label: string }>,
    currentValue: string,
    onPick: (value: string) => void,
  ): { row: HTMLElement; select: HTMLSelectElement } {
    const row = document.createElement('div');
    row.className = 'mc-form-row';

    const label = document.createElement('label');
    label.textContent = labelText;
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'mc-select';
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      select.appendChild(el);
    }
    select.value = currentValue;
    select.addEventListener('change', () => { onPick(select.value); });
    row.appendChild(select);

    return { row, select };
  }

  private markCustom(): void {
    if (this.current.graphicsQuality !== GraphicsQuality.CUSTOM) {
      this.current = { ...this.current, graphicsQuality: GraphicsQuality.CUSTOM };
    }
    if (this.presetSelect !== null) {
      this.presetSelect.value = GraphicsQuality.CUSTOM;
    }
  }

  private applyPreset(quality: Exclude<GraphicsQuality, 'custom'>): void {
    const preset = GRAPHICS_PRESETS[quality];
    this.current = { ...this.current, ...preset, graphicsQuality: quality };

    // Refresh all graphics select/checkbox controls
    for (const refresh of this.graphicsRefreshers) {
      refresh(this.current);
    }
    // Refresh the 4 graphics sliders
    for (const key of GRAPHICS_SLIDER_KEYS) {
      const slider = this.sliders[key];
      if (slider === undefined) continue;
      const v = this.current[key] ?? DEFAULTS[key];
      slider.input.value = String(v);
      slider.valueLabel.textContent = slider.format(v);
    }
    // Sync preset dropdown
    if (this.presetSelect !== null) {
      this.presetSelect.value = quality;
    }

    this.callbacks.onChange(this.current);
  }

  private makeGraphicsCheckboxRow(
    field: 'ssao' | 'normalMaps' | 'bloom',
    labelText: string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'mc-checkbox-row';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `mc-setting-${field}`;
    input.checked = this.current[field] ?? DEFAULTS[field];

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = labelText;

    input.addEventListener('change', () => {
      this.current = { ...this.current, [field]: input.checked };
      this.markCustom();
      this.callbacks.onChange(this.current);
    });

    this.graphicsRefreshers.push((s) => { input.checked = s[field] ?? DEFAULTS[field]; });

    row.appendChild(input);
    row.appendChild(label);
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
    for (const key of [...NUMERIC_KEYS, ...GRAPHICS_SLIDER_KEYS]) {
      const slider = this.sliders[key];
      if (slider === undefined) continue;
      const v = settings[key] ?? DEFAULTS[key];
      slider.input.value = String(v);
      slider.valueLabel.textContent = slider.format(v);
    }
    for (const key of BOOLEAN_KEYS) {
      const cb = this.checkboxes[key];
      if (cb === undefined) continue;
      cb.input.checked = settings[key];
    }
    this.refreshBindingLabels();
    // Sync preset dropdown
    if (this.presetSelect !== null) {
      this.presetSelect.value = settings.graphicsQuality ?? DEFAULTS.graphicsQuality;
    }
    // Refresh all graphics select/checkbox controls
    for (const refresh of this.graphicsRefreshers) {
      refresh(settings);
    }
  }

  override dispose(): void {
    this.cancelListening();
    super.dispose();
  }
}
