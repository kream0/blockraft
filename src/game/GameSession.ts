import * as THREE from 'three';
import { Renderer } from '../rendering/Renderer';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { createChunkMaterial, createWaterMaterial } from '../rendering/Materials';
import { World } from '../world/World';
import { blockRegistry } from '../world/BlockRegistry';
import { Player } from '../player/Player';
import { Controls } from '../player/Controls';
import { Physics } from '../player/Physics';
import { HUD } from '../ui/HUD';
import { BlockInteraction } from '../interaction/BlockInteraction';
import { Cow } from '../entities/Cow';
import { Pig } from '../entities/Pig';
import { Sheep } from '../entities/Sheep';
import type { PassiveMob } from '../entities/PassiveMob';
import { WorldStorage } from '../persistence/WorldStorage';
import {
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  type INetworkAdapter,
  type IWorld,
  type Settings,
  type Vec3,
  type WorldMetadata,
  type WorldSave,
} from '../types';

const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.1;
const AUTO_SAVE_INTERVAL_MS = 30_000;
const PRELOAD_TICKS = 60;
const PASSIVE_MOB_COUNT = 6;
const PASSIVE_SPAWN_MIN_RADIUS = 4;
const PASSIVE_SPAWN_MAX_RADIUS = 14;
const PASSIVE_SPAWN_ATTEMPTS = 40;

/**
 * Finds a dry-land surface to spawn the player on.
 * Walks columns in a square-spiral around (0,0) up to radius 16, picks the first
 * column whose top solid block has AIR (not WATER) directly above it.
 * Falls back to spawning high in the air at (0,0) if no dry column is found.
 */
function findDrySpawn(world: IWorld): Vec3 {
  const MAX_RADIUS = 16;
  for (let r = 0; r <= MAX_RADIUS; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        // Ring at chebyshev distance r only (avoids re-checking inner rings).
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        let topSolid = -1;
        for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
          if (world.isSolid(dx, y, dz)) {
            topSolid = y;
            break;
          }
        }
        if (topSolid < 0) continue;
        if (world.getBlock(dx, topSolid + 1, dz) === BlockId.AIR) {
          return { x: dx + 0.5, y: topSolid + 1.001, z: dz + 0.5 };
        }
      }
    }
  }
  return { x: 0.5, y: CHUNK_HEIGHT - 1, z: 0.5 };
}

/** Finds the highest solid Y at integer (x, z), or -1 if none. */
function topSolidY(world: IWorld, x: number, z: number): number {
  for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
    if (world.isSolid(x, y, z)) return y;
  }
  return -1;
}

export interface GameSessionOptions {
  worldName: string;
  worldStorage: WorldStorage;
  initialSave: WorldSave;
  settings: Settings;
  network: INetworkAdapter;
  hudContainer: HTMLElement;
  rendererTarget: HTMLElement;
  /** Called by the ESC handler. App handles the state transition. */
  onPauseRequested(): void;
}

export class GameSession {
  private renderer: Renderer;
  private atlas: TextureAtlas;
  private chunkMaterial: THREE.Material;
  private waterMaterial: THREE.Material;
  private world: World;
  private player: Player;
  private controls: Controls;
  private physics: Physics;
  private hud: HUD;
  private interaction: BlockInteraction;

  private readonly worldName: string;
  private readonly worldStorage: WorldStorage;
  private readonly initialSave: WorldSave;
  private readonly network: INetworkAdapter;
  private readonly hudContainer: HTMLElement;
  private readonly rendererTarget: HTMLElement;
  private readonly onPauseRequested: () => void;

  private last = 0;
  private acc = 0;
  private rafId: number | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  /** Flips true at the start of stop(). Guards save() and any in-flight ticks. */
  private _disposed: boolean = false;

  private resizeHandler: () => void;
  private slotKeyHandler: (e: KeyboardEvent) => void;
  private mouseDownHandler: (e: MouseEvent) => void;
  private contextMenuHandler: (e: MouseEvent) => void;
  private pointerLockChangeHandler: () => void;
  private escKeyHandler: (e: KeyboardEvent) => void;
  private frame: (t: number) => void;

  constructor(opts: GameSessionOptions) {
    this.worldName = opts.worldName;
    this.worldStorage = opts.worldStorage;
    this.initialSave = opts.initialSave;
    this.network = opts.network;
    this.hudContainer = opts.hudContainer;
    this.rendererTarget = opts.rendererTarget;
    this.onPauseRequested = opts.onPauseRequested;

    const settings = opts.settings;
    const meta = opts.initialSave.metadata;

    // Renderer (lets WebGLRenderer create its own canvas).
    this.renderer = new Renderer(undefined, settings.renderDistance * CHUNK_SIZE);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.rendererTarget.appendChild(this.renderer.renderer.domElement);

    // Atlas + materials.
    this.atlas = new TextureAtlas();
    this.chunkMaterial = createChunkMaterial(this.atlas);
    this.waterMaterial = createWaterMaterial(this.atlas);

    // World — seeded from save metadata, with persisted overrides applied.
    this.world = new World(
      this.atlas,
      this.chunkMaterial,
      this.waterMaterial,
      blockRegistry,
      meta.seed,
      opts.initialSave.overrides,
      settings.renderDistance,
    );
    this.renderer.scene.add(this.world.group);

    // Player at high Y; physics resolves when chunks load.
    this.player = new Player(0, CHUNK_HEIGHT - 1, 0, settings.fov);
    this.renderer.scene.add(this.player.camera);

    // Pre-stream chunks around (0,0) so we can find a real spawn.
    for (let i = 0; i < PRELOAD_TICKS; i++) {
      this.world.update(this.player.state.position);
    }

    // Decide spawn: fresh world if lastPlayed === createdAt, else use persisted state.
    const isFreshWorld = meta.lastPlayed === meta.createdAt;
    if (isFreshWorld) {
      const spawn = findDrySpawn(this.world);
      this.player.state.position.x = spawn.x;
      this.player.state.position.y = spawn.y;
      this.player.state.position.z = spawn.z;
      this.player.state.velocity.y = 0;
      this.player.state.onGround = true;
    } else {
      this.player.state.position.x = meta.playerPosition.x;
      this.player.state.position.y = meta.playerPosition.y;
      this.player.state.position.z = meta.playerPosition.z;
      this.player.state.yaw = meta.playerYaw;
      this.player.state.pitch = meta.playerPitch;
      this.player.setSelectedSlot(meta.selectedSlot);
      this.player.state.velocity.y = 0;
      this.player.state.onGround = true;
      // Re-stream around the persisted position so chunks are ready.
      for (let i = 0; i < PRELOAD_TICKS; i++) {
        this.world.update(this.player.state.position);
      }
    }

    // Controls (pointer-lock target = canvas).
    this.controls = new Controls(this.renderer.renderer.domElement);
    // Initialize from save (yaw/pitch) so mouse-look starts where we left off.
    this.controls.input.yaw = this.player.state.yaw;
    this.controls.input.pitch = this.player.state.pitch;
    this.controls.setSensitivityScale(settings.mouseSensitivity);
    this.controls.setInvertY(settings.invertY);

    // Physics.
    this.physics = new Physics(this.world);

    // HUD — always created/destroyed per session.
    this.hud = new HUD(this.hudContainer, this.player.hotbar);
    // Reflect the persisted hotbar selection visually.
    this.hud.hotbar.setSelectedSlot(this.player.state.selectedSlot);

    // Interaction.
    this.interaction = new BlockInteraction(this.world, this.player);

    // Resize.
    this.resizeHandler = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.player.camera.aspect = w / h;
      this.player.camera.updateProjectionMatrix();
    };

    // Hotbar slot selection (1-9).
    this.slotKeyHandler = (e: KeyboardEvent): void => {
      const code = e.code;
      if (code.length !== 6 || !code.startsWith('Digit')) return;
      const digit = Number.parseInt(code.slice(5), 10);
      if (!Number.isFinite(digit) || digit < 1 || digit > 9) return;
      const slot = digit - 1;
      this.player.setSelectedSlot(slot);
      this.hud.hotbar.setSelectedSlot(slot);
    };

    // Mouse input for break/place (only when pointer-locked).
    this.mouseDownHandler = (e: MouseEvent): void => {
      if (!this.controls.isLocked) return;
      if (e.button === 0) {
        this.interaction.breakBlock();
      } else if (e.button === 2) {
        this.interaction.placeBlock();
      }
    };

    // Suppress browser context menu on canvas (right-click is "place block").
    this.contextMenuHandler = (e: MouseEvent): void => {
      e.preventDefault();
    };

    // Reflect pointer-lock state into HUD ("Click to play" hint).
    this.pointerLockChangeHandler = (): void => {
      this.hud.setLocked(this.controls.isLocked);
    };

    // ESC -> notify App. Browser releases pointer lock automatically.
    this.escKeyHandler = (e: KeyboardEvent): void => {
      if (e.code !== 'Escape') return;
      if (!this.started) return;
      this.onPauseRequested();
    };

    // Game loop.
    this.frame = (t: number): void => {
      const dtMs = this.last !== 0 ? t - this.last : 16.67;
      this.last = t;
      let dt = dtMs / 1000;
      if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
      this.acc += dt;

      // Copy mouse-look input into player state once per frame for smooth view.
      this.player.state.yaw = this.controls.input.yaw;
      this.player.state.pitch = this.controls.input.pitch;

      while (this.acc >= FIXED_DT) {
        this.physics.update(this.player.state, this.controls.input, FIXED_DT);
        this.world.entityManager.update(FIXED_DT, this.world);
        this.acc -= FIXED_DT;
      }

      this.world.update(this.player.state.position);
      this.player.syncCamera();
      this.hud.update(this.player.state, dtMs);
      this.renderer.render(this.player.camera);

      this.rafId = requestAnimationFrame(this.frame);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('keydown', this.slotKeyHandler);
    window.addEventListener('mousedown', this.mouseDownHandler);
    this.renderer.renderer.domElement.addEventListener(
      'contextmenu',
      this.contextMenuHandler,
    );
    document.addEventListener('pointerlockchange', this.pointerLockChangeHandler);
    window.addEventListener('keydown', this.escKeyHandler);

    // Initial HUD lock state.
    this.hud.setLocked(this.controls.isLocked);

    // Populate the world with a small herd of passive animals around the spawn so
    // the world feels alive. They are ephemeral (not persisted) — respawned each load.
    this.spawnPassiveMobs();

    // Auto-save loop.
    this.autoSaveTimer = setInterval(() => {
      this.save().catch((err) => console.error('Auto-save failed:', err));
    }, AUTO_SAVE_INTERVAL_MS);

    // Start render loop.
    this.last = 0;
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.started) return;
    // Clear interval first so a queued auto-save can't fire mid-teardown.
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.started = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Mark disposed BEFORE world.dispose() so any in-flight save() bails out.
    this._disposed = true;

    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.slotKeyHandler);
    window.removeEventListener('mousedown', this.mouseDownHandler);
    this.renderer.renderer.domElement.removeEventListener(
      'contextmenu',
      this.contextMenuHandler,
    );
    document.removeEventListener('pointerlockchange', this.pointerLockChangeHandler);
    window.removeEventListener('keydown', this.escKeyHandler);

    this.controls.unlock();
    this.controls.dispose();
    this.hud.dispose();

    // Detach canvas from DOM BEFORE disposing the renderer so a stale GL context
    // can't try to render into a still-attached canvas during dispose.
    const canvas = this.renderer.renderer.domElement;
    if (canvas.parentNode !== null) {
      canvas.parentNode.removeChild(canvas);
    }

    this.renderer.scene.remove(this.world.group);
    this.renderer.scene.remove(this.player.camera);
    this.world.dispose();
    this.renderer.dispose();
    this.chunkMaterial.dispose();
    this.waterMaterial.dispose();
    this.atlas.texture.dispose();
  }

  /** Persist current player state + overrides via WorldStorage. */
  async save(): Promise<void> {
    if (this._disposed) return;
    const baseMeta = this.initialSave.metadata;
    const metadata: WorldMetadata = {
      name: baseMeta.name,
      seed: baseMeta.seed,
      createdAt: baseMeta.createdAt,
      lastPlayed: Date.now(),
      gameMode: baseMeta.gameMode,
      playerPosition: {
        x: this.player.state.position.x,
        y: this.player.state.position.y,
        z: this.player.state.position.z,
      },
      playerYaw: this.player.state.yaw,
      playerPitch: this.player.state.pitch,
      selectedSlot: this.player.state.selectedSlot,
    };
    const save: WorldSave = {
      metadata,
      overrides: this.world.getOverrides(),
    };
    await this.worldStorage.saveWorld(save);
  }

  /** Apply settings live (FOV, mouse sensitivity, invertY, render distance). */
  applySettings(settings: Settings): void {
    this.player.setFov(settings.fov);
    this.renderer.setFogFar(settings.renderDistance * CHUNK_SIZE);
    this.world.setRenderDistance(settings.renderDistance);
    this.controls.setSensitivityScale(settings.mouseSensitivity);
    this.controls.setInvertY(settings.invertY);
  }

  /** True iff pointer-locked (in active gameplay). */
  isLocked(): boolean {
    return this.controls.isLocked;
  }

  /** Re-acquire pointer lock (called from a user-gesture handler like Resume button). */
  requestPointerLock(): void {
    this.controls.lock();
  }

  /** Reference the network adapter (kept so the field is used; reserved for future entity sync). */
  getNetwork(): INetworkAdapter {
    return this.network;
  }

  /** Reference the world name (kept so the field is used; reserved for save UI). */
  getWorldName(): string {
    return this.worldName;
  }

  private spawnPassiveMobs(): void {
    const px = this.player.state.position.x;
    const pz = this.player.state.position.z;
    const factories: ((p: Vec3) => PassiveMob)[] = [
      (p) => new Cow(p),
      (p) => new Pig(p),
      (p) => new Sheep(p),
    ];
    let spawned = 0;
    for (
      let attempt = 0;
      attempt < PASSIVE_SPAWN_ATTEMPTS && spawned < PASSIVE_MOB_COUNT;
      attempt++
    ) {
      const angle = Math.random() * Math.PI * 2;
      const dist =
        PASSIVE_SPAWN_MIN_RADIUS +
        Math.random() * (PASSIVE_SPAWN_MAX_RADIUS - PASSIVE_SPAWN_MIN_RADIUS);
      const sx = Math.floor(px + Math.cos(angle) * dist);
      const sz = Math.floor(pz + Math.sin(angle) * dist);
      const sy = topSolidY(this.world, sx, sz);
      if (sy < 0) continue;
      // Require open air directly above the top solid block. This naturally skips
      // water columns (their top solid block is the lake bed, with WATER above).
      if (this.world.getBlock(sx, sy + 1, sz) !== BlockId.AIR) continue;
      const make = factories[spawned % factories.length]!;
      const mob = make({ x: sx + 0.5, y: sy + 1, z: sz + 0.5 });
      this.world.entityManager.spawn(mob);
      spawned++;
    }
  }
}
