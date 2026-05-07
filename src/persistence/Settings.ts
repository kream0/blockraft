import { type Settings, DEFAULT_SETTINGS, SETTINGS_RANGES } from '../types';
import { clamp } from '../utils/MathUtils';

/** localStorage key used to persist user settings. */
const STORAGE_KEY = 'mc-clone:settings';

/**
 * Validate: clamp every numeric to its SETTINGS_RANGES min/max, coerce booleans.
 * Returns a new object. Never throws on bad input — falls back to DEFAULT_SETTINGS
 * field-by-field.
 */
export function validateSettings(input: unknown): Settings {
  const obj: Record<string, unknown> =
    input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  const num = (key: keyof typeof SETTINGS_RANGES, fallback: number): number => {
    const raw = obj[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
    const range = SETTINGS_RANGES[key];
    return clamp(raw, range.min, range.max);
  };

  const bool = (key: 'invertY' | 'showFps', fallback: boolean): boolean => {
    const raw = obj[key];
    return typeof raw === 'boolean' ? raw : fallback;
  };

  const renderDistance = Math.round(num('renderDistance', DEFAULT_SETTINGS.renderDistance));

  return {
    renderDistance,
    fov: num('fov', DEFAULT_SETTINGS.fov),
    mouseSensitivity: num('mouseSensitivity', DEFAULT_SETTINGS.mouseSensitivity),
    masterVolume: num('masterVolume', DEFAULT_SETTINGS.masterVolume),
    musicVolume: num('musicVolume', DEFAULT_SETTINGS.musicVolume),
    sfxVolume: num('sfxVolume', DEFAULT_SETTINGS.sfxVolume),
    invertY: bool('invertY', DEFAULT_SETTINGS.invertY),
    showFps: bool('showFps', DEFAULT_SETTINGS.showFps),
  };
}

/** Load from localStorage; returns DEFAULT_SETTINGS if missing or corrupt. Always validated. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    return validateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist; clamps + validates first. Catches QuotaExceededError silently (best effort). */
export function saveSettings(settings: Settings): void {
  const clean = validateSettings(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Best effort — localStorage may be disabled or full.
  }
}
