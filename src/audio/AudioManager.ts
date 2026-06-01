/**
 * AudioManager — procedural sound effects via the Web Audio API.
 *
 * All sounds are synthesized at runtime using oscillators, noise buffers, and
 * biquad filters. No audio files are loaded. This keeps the project's
 * "no external assets" ethos consistent with the procedural texture atlas.
 *
 * Bus graph:
 *   sfxGain  ─┐
 *              ├─► masterGain ─► ctx.destination
 *   musicGain ─┘
 *
 * Volume semantics: effective SFX loudness = master × sfx (via the bus chain).
 * Volumes are NOT pre-multiplied; each gain node holds its own raw value.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private musicMix: GainNode | null = null;
  private musicSources: OscillatorNode[] = []; // chord oscillators AND LFOs (all need .stop())
  private musicGains: GainNode[] = [];         // musicMix + per-voice gains + LFO gains (all need .disconnect())
  private musicStarted = false;

  // Pre-built mono white-noise buffer (~0.2 s). Created once on resume() and
  // shared across all noise-based shots. A BufferSourceNode can only be started
  // once, so each shot wraps the buffer in a *new* source node.
  private noiseBuffer: AudioBuffer | null = null;

  // Stored volume levels. Applied to gain nodes once the context is created,
  // so callers can safely call setVolumes() before resume().
  private master = 1;
  private music = 1;
  private sfx = 1;

  /**
   * Construction is intentionally cheap and side-effect-free: no AudioContext is
   * created here because browsers block audio context creation outside a user
   * gesture (click / keydown). Call resume() from inside a gesture handler.
   */
  constructor() {
    // Intentionally empty — see resume() for deferred initialisation.
  }

  /**
   * Lazily create the AudioContext on first call and resume it if suspended.
   *
   * MUST be called from inside a synchronous user-gesture handler the very first
   * time (browsers enforce this). Subsequent calls are idempotent: they only
   * resume a suspended context and return immediately. Safe no-op if the browser
   * does not expose Web Audio.
   */
  resume(): void {
    if (this.ctx !== null) {
      // Context already exists — just unpause it if the browser suspended it
      // (common on tab switch or during auto-play policy enforcement).
      void this.ctx.resume();
      return;
    }

    // Guard: don't crash in non-browser environments (SSR, tests).
    const Ctor = window.AudioContext;
    if (Ctor === undefined) return;

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      // Browser may throw if the user's audio subsystem is unavailable.
      // Leave ctx null and degrade silently — sound is non-critical.
      return;
    }

    // Build gain bus graph: sfx → master → destination
    //                        music → master
    const masterGain = ctx.createGain();
    const sfxGain    = ctx.createGain();
    const musicGain  = ctx.createGain();

    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Apply any volumes that were set before the context existed.
    masterGain.gain.value = this.master;
    sfxGain.gain.value    = this.sfx;
    musicGain.gain.value  = this.music;

    // Pre-fill a mono white-noise buffer (~0.2 s). All noise-based shots share
    // this buffer; they each own a fresh BufferSourceNode (sources are one-shot).
    const noiseLength = Math.ceil(ctx.sampleRate * 0.2);
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Writes to Float32Array are safe under noUncheckedIndexedAccess — only reads
    // produce `T | undefined`, not writes. No read-back here.
    for (let i = 0; i < noiseLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.ctx         = ctx;
    this.masterGain  = masterGain;
    this.sfxGain     = sfxGain;
    this.musicGain   = musicGain;
    this.noiseBuffer = noiseBuffer;

    // Unblock playback: browsers may create the context in the 'suspended' state
    // even when created inside a gesture, so call resume() explicitly.
    void ctx.resume();
    this.startMusic();
  }

  /**
   * Set the three volume buses. Each value is clamped to [0, 1].
   * Safe to call before resume() — values are stored and applied when the
   * context is created.
   */
  setVolumes(master: number, music: number, sfx: number): void {
    this.master = clamp01(master);
    this.music  = clamp01(music);
    this.sfx    = clamp01(sfx);

    // If the gain nodes already exist, apply immediately (live-update).
    if (this.masterGain !== null) this.masterGain.gain.value = this.master;
    if (this.musicGain  !== null) this.musicGain.gain.value  = this.music;
    if (this.sfxGain    !== null) this.sfxGain.gain.value    = this.sfx;
  }

  /**
   * One-shot "crunch" sound for breaking a block.
   *
   * Filtered white noise shaped by a short exponential decay. A lowpass filter
   * knocks off high-frequency hiss, leaving a dull, earthy crunch.
   */
  playBreak(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.state !== 'running' || this.sfxGain === null) return;

    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    // Slight random pitch shift so repeated breaks don't sound identical.
    source.playbackRate.value = 0.9 + Math.random() * 0.2;

    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 2000;

    const env = this.envGain(ctx, now, 0.5, 0.005, 0.12);

    source.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    source.start(now);
    source.stop(now + 0.12);
  }

  /**
   * One-shot "thock" sound for placing a block.
   *
   * A triangle oscillator that drops in pitch mimics the resonance of a block
   * landing on a solid surface.
   */
  playPlace(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.state !== 'running' || this.sfxGain === null) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    const env = this.envGain(ctx, now, 0.4, 0.005, 0.10);

    osc.connect(env);
    env.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.10);
  }

  /**
   * One-shot descending "ugh" for when the player takes damage.
   *
   * A square wave falls from 240 Hz to 90 Hz over ~0.18 s, giving a
   * slightly harsh vocal-like quality.
   */
  playHurt(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.state !== 'running' || this.sfxGain === null) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

    const env = this.envGain(ctx, now, 0.35, 0.005, 0.20);

    osc.connect(env);
    env.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.20);
  }

  /**
   * One-shot "swing" for a melee attack.
   *
   * A bandpass-filtered noise burst with a very short envelope mimics the
   * whoosh of something cutting through air.
   */
  playAttack(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.state !== 'running' || this.sfxGain === null) return;

    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    // Slightly higher pitch range than break — a faster swing sounds higher.
    source.playbackRate.value = 1.0 + Math.random() * 0.3;

    const filter = ctx.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value         = 1.0;

    const env = this.envGain(ctx, now, 0.3, 0.004, 0.08);

    source.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    source.start(now);
    source.stop(now + 0.08);
  }

  /**
   * One-shot "crit" blip for a critical (mid-fall) melee hit.
   *
   * A sawtooth oscillator sweeps upward from 520 Hz to 1040 Hz over ~80 ms,
   * then a second short sine "ping" fires at 1400 Hz for 40 ms — producing a
   * bright rising two-tone blip that is clearly distinct from the flat-noise
   * swing of playAttack(). Both tones share the same sfxGain bus.
   */
  playCrit(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.state !== 'running' || this.sfxGain === null) return;

    const now = ctx.currentTime;

    // Rising sweep tone (sawtooth, 520→1040 Hz, 80 ms).
    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(520, now);
    sweep.frequency.exponentialRampToValueAtTime(1040, now + 0.08);

    const sweepEnv = this.envGain(ctx, now, 0.18, 0.004, 0.08);

    sweep.connect(sweepEnv);
    sweepEnv.connect(this.sfxGain);

    sweep.start(now);
    sweep.stop(now + 0.08);

    // High "ping" sine that follows immediately (1400 Hz, 40 ms).
    const ping = ctx.createOscillator();
    ping.type = 'sine';
    ping.frequency.value = 1400;

    const pingEnv = this.envGain(ctx, now + 0.06, 0.22, 0.004, 0.06);

    ping.connect(pingEnv);
    pingEnv.connect(this.sfxGain);

    ping.start(now + 0.06);
    ping.stop(now + 0.14);
  }

  /** Close the AudioContext and release all node references. */
  dispose(): void {
    this.stopMusic();
    if (this.ctx !== null) {
      try {
        void this.ctx.close();
      } catch {
        // close() may throw if already closed; ignore — we're disposing anyway.
      }
    }
    this.ctx         = null;
    this.masterGain  = null;
    this.sfxGain     = null;
    this.musicGain   = null;
    this.noiseBuffer = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private startMusic(): void {
    const ctx = this.ctx;
    const musicGain = this.musicGain;
    if (ctx === null || musicGain === null || this.musicStarted) return;
    this.musicStarted = true;

    const now = ctx.currentTime;

    const musicMix = ctx.createGain();
    musicMix.gain.setValueAtTime(0, now);
    musicMix.gain.linearRampToValueAtTime(MUSIC_MIX_GAIN, now + MUSIC_FADE_IN_S);
    musicMix.connect(musicGain);
    this.musicMix = musicMix;
    this.musicGains.push(musicMix);

    for (const v of MUSIC_VOICES) {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = MUSIC_VOICE_GAIN;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = v.lfoRate;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = MUSIC_SWELL_DEPTH;

      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);

      osc.connect(voiceGain);
      voiceGain.connect(musicMix);

      osc.start(now);
      lfo.start(now);

      this.musicSources.push(osc, lfo);
      this.musicGains.push(voiceGain, lfoGain);
    }
  }

  private stopMusic(): void {
    for (const osc of this.musicSources) {
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
    }
    for (const g of this.musicGains) {
      g.disconnect();
    }
    this.musicSources = [];
    this.musicGains = [];
    this.musicMix = null;
    this.musicStarted = false;
  }

  /**
   * Build a one-shot envelope GainNode for click-free attack + decay.
   *
   * Uses exponential ramps throughout. The start and end values are 0.0001
   * rather than 0 because exponentialRampToValueAtTime requires a positive
   * target (logarithm of zero is undefined).
   *
   * @param ctx    - The running AudioContext (caller guarantees non-null).
   * @param now    - ctx.currentTime at the moment the shot is triggered.
   * @param peak   - Peak gain value reached at the end of the attack.
   * @param attack - Duration of the attack ramp in seconds.
   * @param dur    - Total envelope duration in seconds (attack + decay combined).
   */
  private envGain(
    ctx: AudioContext,
    now: number,
    peak: number,
    attack: number,
    dur: number,
  ): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    return g;
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers (not exported — internal only)
// ---------------------------------------------------------------------------

/** Clamp v to the closed interval [0, 1]. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Ambient music pad constants
// ---------------------------------------------------------------------------

const MUSIC_MIX_GAIN = 0.3;     // headroom: 4 voices × ~0.14 peak × 0.3 ≈ 0.17 into musicGain, no clipping
const MUSIC_VOICE_GAIN = 0.09;  // base per-voice gain (LFO swells around this)
const MUSIC_SWELL_DEPTH = 0.05; // LFO gain depth → each voice oscillates in [0.04, 0.14]
const MUSIC_FADE_IN_S = 2;      // gentle fade-in to avoid a click on start

type MusicVoice = { freq: number; type: OscillatorType; detune: number; lfoRate: number };
// Open A+E stack (root + fifth, octave-doubled): very consonant, ambient. Low voices sine, upper voices triangle for a little shimmer.
const MUSIC_VOICES: MusicVoice[] = [
  { freq: 110.00, type: 'sine',     detune: -5, lfoRate: 0.033 }, // A2
  { freq: 164.81, type: 'sine',     detune:  4, lfoRate: 0.041 }, // E3
  { freq: 220.00, type: 'triangle', detune: -3, lfoRate: 0.027 }, // A3
  { freq: 329.63, type: 'triangle', detune:  6, lfoRate: 0.037 }, // E4
];
