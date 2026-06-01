import {
  type Settings, type Keybindings, type KeyBindableAction,
  type GraphicsQuality, type AntiAlias, type WaterQuality, type EdgeRounding,
  type ShadowSoftness, type ToneMapping, type FogType, type CloudDetail,
  DEFAULT_SETTINGS, DEFAULT_KEYBINDINGS, SETTINGS_RANGES, KEYBINDABLE_ACTIONS,
  GraphicsQuality as GQ, AntiAlias as AA, WaterQuality as WQ, EdgeRounding as ER,
  ShadowSoftness as SS, ToneMapping as TM, FogType as FT, CloudDetail as CD,
  SHADOW_MAP_SIZES, SSAO_SAMPLE_COUNTS, ATLAS_TILE_SIZES, ANISOTROPY_LEVELS,
} from '../types';
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

  const bool = (key: 'invertY' | 'showFps' | 'ssao' | 'normalMaps' | 'bloom' | 'emissiveBloom', fallback: boolean): boolean => {
    const raw = obj[key];
    return typeof raw === 'boolean' ? raw : fallback;
  };

  const enumVal = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = obj[key];
    return (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) ? (raw as T) : fallback;
  };

  const discreteNum = (key: string, allowed: readonly number[], fallback: number): number => {
    const raw = obj[key];
    return (typeof raw === 'number' && Number.isFinite(raw) && (allowed as readonly number[]).includes(raw)) ? raw : fallback;
  };

  // Validate keybindings: for each action, accept a non-empty string or fall back to default.
  const keybindings = ((): Keybindings => {
    const raw = obj['keybindings'];
    const src: Record<string, unknown> =
      raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const result = { ...DEFAULT_KEYBINDINGS };
    for (const action of KEYBINDABLE_ACTIONS) {
      const v = src[action];
      if (typeof v === 'string' && v.length > 0) {
        result[action as KeyBindableAction] = v;
      }
    }
    return result;
  })();

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
    keybindings,
    graphicsQuality: enumVal<GraphicsQuality>('graphicsQuality', Object.values(GQ), DEFAULT_SETTINGS.graphicsQuality!),
    pixelRatioCap: num('pixelRatioCap', DEFAULT_SETTINGS.pixelRatioCap!),
    antiAlias: enumVal<AntiAlias>('antiAlias', Object.values(AA), DEFAULT_SETTINGS.antiAlias!),
    shadowMapSize: discreteNum('shadowMapSize', SHADOW_MAP_SIZES, DEFAULT_SETTINGS.shadowMapSize!),
    shadowSoftness: enumVal<ShadowSoftness>('shadowSoftness', Object.values(SS), DEFAULT_SETTINGS.shadowSoftness!),
    ssao: bool('ssao', DEFAULT_SETTINGS.ssao!),
    ssaoIntensity: num('ssaoIntensity', DEFAULT_SETTINGS.ssaoIntensity!),
    ssaoSamples: discreteNum('ssaoSamples', SSAO_SAMPLE_COUNTS, DEFAULT_SETTINGS.ssaoSamples!),
    normalMaps: bool('normalMaps', DEFAULT_SETTINGS.normalMaps!),
    edgeRounding: enumVal<EdgeRounding>('edgeRounding', Object.values(ER), DEFAULT_SETTINGS.edgeRounding!),
    atlasTileSize: discreteNum('atlasTileSize', ATLAS_TILE_SIZES, DEFAULT_SETTINGS.atlasTileSize!),
    anisotropy: discreteNum('anisotropy', ANISOTROPY_LEVELS, DEFAULT_SETTINGS.anisotropy!),
    toneMapping: enumVal<ToneMapping>('toneMapping', Object.values(TM), DEFAULT_SETTINGS.toneMapping!),
    fogType: enumVal<FogType>('fogType', Object.values(FT), DEFAULT_SETTINGS.fogType!),
    bloom: bool('bloom', DEFAULT_SETTINGS.bloom!),
    bloomIntensity: num('bloomIntensity', DEFAULT_SETTINGS.bloomIntensity!),
    bloomThreshold: num('bloomThreshold', DEFAULT_SETTINGS.bloomThreshold!),
    emissiveBloom: bool('emissiveBloom', DEFAULT_SETTINGS.emissiveBloom!),
    waterQuality: enumVal<WaterQuality>('waterQuality', Object.values(WQ), DEFAULT_SETTINGS.waterQuality!),
    cloudDetail: enumVal<CloudDetail>('cloudDetail', Object.values(CD), DEFAULT_SETTINGS.cloudDetail!),
  };
}

/** Load from localStorage; returns DEFAULT_SETTINGS if missing or corrupt. Always validated. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } };
    const parsed: unknown = JSON.parse(raw);
    return validateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } };
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
