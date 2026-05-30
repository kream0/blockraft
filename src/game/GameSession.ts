import * as THREE from 'three';
import { Renderer } from '../rendering/Renderer';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { createChunkMaterial, createWaterMaterial } from '../rendering/Materials';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { BreakOverlay } from '../rendering/BreakOverlay';
import { AudioManager } from '../audio/AudioManager';
import { World } from '../world/World';
import { blockRegistry } from '../world/BlockRegistry';
import { toolMultiplierFor, blockDropFor, itemToolDef, itemFoodDef, foodDropForMob } from '../items/ItemRegistry';
import { ItemIconRenderer } from '../rendering/ItemIconRenderer';
import { buildItemMesh } from '../items/ItemMesh';
import { Player } from '../player/Player';
import { Controls } from '../player/Controls';
import { Physics } from '../player/Physics';
import { ViewModel } from '../player/ViewModel';
import { HUD } from '../ui/HUD';
import { InventoryScreen } from '../ui/InventoryScreen';
import { BlockInteraction } from '../interaction/BlockInteraction';
import { Cow } from '../entities/Cow';
import { Pig } from '../entities/Pig';
import { Sheep } from '../entities/Sheep';
import { Chicken } from '../entities/Chicken';
import type { PassiveMob } from '../entities/PassiveMob';
import { Zombie } from '../entities/Zombie';
import { Skeleton } from '../entities/Skeleton';
import { Arrow } from '../entities/Arrow';
import { DroppedItem } from '../entities/DroppedItem';
import { Mob } from '../entities/Mob';
import { WorldStorage } from '../persistence/WorldStorage';
import {
  BlockId,
  ItemId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GameMode,
  PLAYER_MAX_HEALTH,
  PLAYER_RESPAWN_INVULN_S,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE,
  PLAYER_ATTACK_COOLDOWN_S,
  PLAYER_EYE,
  PLAYER_MAX_AIR_S,
  DROWN_DAMAGE,
  DROWN_INTERVAL_S,
  ZOMBIE_MAX_COUNT,
  ZOMBIE_ATTACK_RANGE,
  ZOMBIE_ATTACK_DAMAGE,
  SKELETON_MAX_COUNT,
  ARROW_DAMAGE,
  ARROW_HIT_RADIUS,
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  FALL_DAMAGE_SAFE_BLOCKS,
  FALL_DAMAGE_PER_BLOCK,
  HEALTH_REGEN_DELAY_S,
  HEALTH_REGEN_INTERVAL_S,
  PLAYER_MAX_HUNGER,
  HUNGER_REGEN_THRESHOLD,
  EXHAUSTION_PER_HUNGER,
  EXHAUSTION_IDLE_PER_S,
  EXHAUSTION_WALK_PER_BLOCK,
  EXHAUSTION_SPRINT_PER_BLOCK,
  EXHAUSTION_JUMP,
  EXHAUSTION_PER_HEAL,
  STARVE_DAMAGE,
  STARVE_INTERVAL_S,
  STARVE_FLOOR_HP,
  EAT_DURATION_S,
  DROPPED_ITEM_PICKUP_RADIUS,
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
const HOSTILE_SPAWN_INTERVAL_S = 4;
const HOSTILE_SPAWN_MIN_RADIUS = 12;
const HOSTILE_SPAWN_MAX_RADIUS = 28;
const HOSTILE_SPAWN_ATTEMPTS = 12;

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
  /** Called when the player's health reaches 0. App shows the death overlay. */
  onDeath(): void;
}

export class GameSession {
  private renderer: Renderer;
  private particles: ParticleSystem;
  private breakOverlay: BreakOverlay;
  private audio: AudioManager;
  private dayNight: DayNightCycle;
  private atlas: TextureAtlas;
  private iconRenderer: ItemIconRenderer;
  private heldItemId: ItemId | null = null;
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
  private readonly onDeath: () => void;

  private last = 0;
  private acc = 0;
  private rafId: number | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  /** Flips true at the start of stop(). Guards save() and any in-flight ticks. */
  private _disposed: boolean = false;
  private readonly gameMode: GameMode;
  private hostileSpawnAcc: number = 0;
  private respawnInvuln: number = 0;
  /** True from the moment health hits 0 until the player clicks Respawn. Freezes hostile contact and de-dupes the death event. */
  private isDead: boolean = false;
  /** Highest Y reached during the current fall arc; fall distance = peak − landing Y. Reset on land/spawn. */
  private fallPeakY: number = 0;
  /** Seconds since the player last took damage; passive regen only begins after HEALTH_REGEN_DELAY_S. */
  private timeSinceLastDamage: number = 0;
  /** Accumulator (seconds) toward the next half-heart of passive regen. */
  private healthRegenAcc: number = 0;
  /** Seconds of breathable air remaining while the head is submerged; refills to PLAYER_MAX_AIR_S on surfacing. */
  private air: number = PLAYER_MAX_AIR_S;
  /** Accumulator (seconds) toward the next drowning damage tick once air is depleted. */
  private drownAcc: number = 0;
  /** Wall-clock seconds remaining until the player's next melee swing is allowed. */
  private playerAttackCooldown: number = 0;
  private wasNight: boolean = false;

  /** Accumulated activity exhaustion; each EXHAUSTION_PER_HUNGER converts to -1 hunger. */
  private exhaustion = 0;
  /** Seconds since the last starvation damage tick (only counts while hunger is 0). */
  private starveTimer = 0;
  /** True while the right mouse button is held (drives hold-to-eat). */
  private rightHeld = false;
  /** Seconds spent eating the currently-held food. */
  private eatProgress = 0;

  private viewModel: ViewModel;
  private mouseUpHandler: (e: MouseEvent) => void;
  /** True while the left mouse button is held (drives hold-to-mine). */
  private leftHeld: boolean = false;
  /** "x,y,z" of the block currently being mined, or null. Progress resets when this changes. */
  private mineTargetKey: string | null = null;
  /** Seconds of mining accumulated on the current target. */
  private mineProgress: number = 0;
  /** Seconds required to break the current target (0 = instant, e.g. creative). */
  private mineTotal: number = 0;

  private inventoryScreen: InventoryScreen;
  private inventoryKeyHandler: (e: KeyboardEvent) => void;

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
    this.onDeath = opts.onDeath;

    const settings = opts.settings;
    const meta = opts.initialSave.metadata;
    this.gameMode = meta.gameMode;

    // Renderer (lets WebGLRenderer create its own canvas).
    this.renderer = new Renderer(undefined, settings.renderDistance * CHUNK_SIZE);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.rendererTarget.appendChild(this.renderer.renderer.domElement);

    // Day/night cycle — drives sky color + sun/ambient lighting. Not persisted (resets each load).
    this.dayNight = new DayNightCycle();
    this.renderer.applySky(this.dayNight.getSkyState());

    // Atlas + materials.
    this.atlas = new TextureAtlas();
    this.iconRenderer = new ItemIconRenderer(this.atlas);
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
    this.player = new Player(0, CHUNK_HEIGHT - 1, 0, settings.fov, this.gameMode);
    this.renderer.scene.add(this.player.camera);

    // First-person hand, parented to the camera so it always tracks the view.
    this.viewModel = new ViewModel();
    this.player.camera.add(this.viewModel.object3D);

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
      if (this.gameMode === GameMode.SURVIVAL && meta.inventory !== undefined) {
        this.player.inventory.deserialize(meta.inventory);
      }
      this.player.state.velocity.y = 0;
      this.player.state.onGround = true;
      // Re-stream around the persisted position so chunks are ready.
      for (let i = 0; i < PRELOAD_TICKS; i++) {
        this.world.update(this.player.state.position);
      }
    }

    // Hostile mobs chase this live reference; Physics mutates it in place each tick.
    this.world.setTrackedTarget(this.player.state.position);

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
    this.hud = new HUD(this.hudContainer, this.player.inventory.hotbarSlots(), this.gameMode === GameMode.SURVIVAL, this.iconRenderer);
    this.inventoryScreen = new InventoryScreen(this.hudContainer, this.player.inventory, this.iconRenderer);
    // Reflect the persisted hotbar selection visually.
    this.hud.hotbar.setSelectedSlot(this.player.state.selectedSlot);
    this.hud.setTimeOfDay(this.dayNight.normalizedTime);
    this.hud.setShowFps(settings.showFps);
    if (this.gameMode === GameMode.SURVIVAL) {
      this.hud.setHealth(this.player.state.health, PLAYER_MAX_HEALTH);
      this.hud.setAir(PLAYER_MAX_AIR_S, PLAYER_MAX_AIR_S);
    }

    // Interaction.
    this.interaction = new BlockInteraction(this.world, this.player);

    // Block-break particles.
    this.particles = new ParticleSystem();
    this.renderer.scene.add(this.particles.object3D);

    // Block-crack overlay.
    this.breakOverlay = new BreakOverlay();
    this.renderer.scene.add(this.breakOverlay.object3D);

    // Procedural SFX. AudioContext is created lazily on the first user gesture
    // (see requestPointerLock / mouseDownHandler), not here.
    this.audio = new AudioManager();
    this.audio.setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume);

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
      if (this.inventoryScreen.isOpen) return;
      const code = e.code;
      if (code.length !== 6 || !code.startsWith('Digit')) return;
      const digit = Number.parseInt(code.slice(5), 10);
      if (!Number.isFinite(digit) || digit < 1 || digit > 9) return;
      const slot = digit - 1;
      this.player.setSelectedSlot(slot);
      this.hud.hotbar.setSelectedSlot(slot);
    };

    // Mouse input (only when pointer-locked). Left = hold-to-mine / melee; right = place.
    this.mouseDownHandler = (e: MouseEvent): void => {
      if (!this.controls.isLocked) return;
      // A locked-canvas mousedown is a user gesture — safe to (idempotently) start audio.
      this.audio.resume();
      if (e.button === 0) {
        this.leftHeld = true;
        // Melee takes priority over mining when a mob is in the attack cone.
        if (this.tryMeleeAttack()) {
          this.viewModel.triggerSwing();
        }
        // Block mining itself is handled per-frame in updateMining().
      } else if (e.button === 2) {
        this.rightHeld = true;
        if (this.interaction.placeBlock()) {
          if (this.gameMode === GameMode.SURVIVAL) {
            this.player.inventory.removeOne(this.player.state.selectedSlot);
          }
          this.audio.playPlace();
          this.viewModel.triggerSwing();
        }
      }
    };

    // Release stops hold-to-mine and hold-to-eat.
    this.mouseUpHandler = (e: MouseEvent): void => {
      if (e.button === 0) this.leftHeld = false;
      if (e.button === 2) { this.rightHeld = false; this.eatProgress = 0; }
    };

    // Suppress browser context menu on canvas (right-click is "place block").
    this.contextMenuHandler = (e: MouseEvent): void => {
      e.preventDefault();
    };

    // Reflect pointer-lock state into HUD ("Click to play" hint).
    this.pointerLockChangeHandler = (): void => {
      this.hud.setLocked(this.controls.isLocked);
      if (!this.controls.isLocked) { this.leftHeld = false; this.rightHeld = false; this.eatProgress = 0; }
    };

    // Inventory toggle (E key, both game modes).
    this.inventoryKeyHandler = (e: KeyboardEvent): void => {
      if (e.code !== 'KeyE') return;
      if (!this.started || this.isDead) return;
      if (this.inventoryScreen.isOpen) {
        this.inventoryScreen.close();
        this.requestPointerLock();           // KeyE keydown is a user gesture → re-lock OK
      } else {
        if (!this.controls.isLocked) return; // only open from active play
        this.inventoryScreen.open();
        this.controls.unlock();
        this.leftHeld = false;
        this.rightHeld = false; this.eatProgress = 0;
      }
    };

    // ESC -> close inventory if open, else notify App. Browser releases pointer lock automatically.
    this.escKeyHandler = (e: KeyboardEvent): void => {
      if (e.code !== 'Escape') return;
      if (!this.started) return;
      if (this.inventoryScreen.isOpen) {
        this.inventoryScreen.close();
        this.requestPointerLock();
        return;
      }
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
        if (!this.inventoryScreen.isOpen) {
          // Freeze the player in place while dead so the death cam doesn't drift/fall.
          if (!this.isDead) {
            const wasOnGround = this.player.state.onGround;
            this.physics.update(this.player.state, this.controls.input, FIXED_DT);
            this.updateFallDamage(wasOnGround);
            if (this.gameMode === GameMode.SURVIVAL) this.updateHunger(wasOnGround);
          }
          this.world.entityManager.update(FIXED_DT, this.world);
          this.updateDroppedItems();
          this.applyHostileContact(FIXED_DT);
          this.updateSkeletonFire();
          this.updateArrows();
        }
        this.acc -= FIXED_DT;
      }

      this.world.update(this.player.state.position);
      this.updateHostiles(dt);
      this.playerAttackCooldown = Math.max(0, this.playerAttackCooldown - dt);
      this.player.syncCamera();
      this.updateMining(dt);
      this.updateEating(dt);
      this.viewModel.update(dt);
      const selItem = this.player.inventory.getSlot(this.player.state.selectedSlot)?.item ?? null;
      if (selItem !== this.heldItemId) {
        this.heldItemId = selItem;
        const isTool = selItem !== null && itemToolDef(selItem) !== null;
        this.viewModel.setHeldItem(selItem === null ? null : buildItemMesh(selItem, this.atlas), isTool);
      }
      this.hud.update(this.player.state, dtMs);
      this.hud.setHotbarStacks(this.player.inventory.hotbarSlots());
      this.dayNight.update(dt);
      this.renderer.applySky(this.dayNight.getSkyState());
      this.hud.setTimeOfDay(this.dayNight.normalizedTime);
      this.hud.setUnderwater(this.isHeadSubmerged());
      this.updateBreath(dt);
      this.updateHealthRegen(dt);
      if (this.gameMode === GameMode.SURVIVAL) {
        this.hud.setHealth(this.player.state.health, PLAYER_MAX_HEALTH);
        this.hud.setAir(this.air, PLAYER_MAX_AIR_S);
        this.hud.setHunger(this.player.state.hunger, PLAYER_MAX_HUNGER);
      }
      this.particles.update(dt);
      this.renderer.render(this.player.camera);

      this.rafId = requestAnimationFrame(this.frame);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('keydown', this.slotKeyHandler);
    window.addEventListener('keydown', this.inventoryKeyHandler);
    window.addEventListener('mousedown', this.mouseDownHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
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
    this.fallPeakY = this.player.state.position.y;
    this.timeSinceLastDamage = 0;
    this.healthRegenAcc = 0;
    this.air = PLAYER_MAX_AIR_S;
    this.drownAcc = 0;
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
    window.removeEventListener('keydown', this.inventoryKeyHandler);
    window.removeEventListener('mousedown', this.mouseDownHandler);
    window.removeEventListener('mouseup', this.mouseUpHandler);
    this.renderer.renderer.domElement.removeEventListener(
      'contextmenu',
      this.contextMenuHandler,
    );
    document.removeEventListener('pointerlockchange', this.pointerLockChangeHandler);
    window.removeEventListener('keydown', this.escKeyHandler);

    this.controls.unlock();
    this.controls.dispose();
    this.hud.dispose();
    this.inventoryScreen.dispose();

    // Detach canvas from DOM BEFORE disposing the renderer so a stale GL context
    // can't try to render into a still-attached canvas during dispose.
    const canvas = this.renderer.renderer.domElement;
    if (canvas.parentNode !== null) {
      canvas.parentNode.removeChild(canvas);
    }

    this.renderer.scene.remove(this.world.group);
    this.renderer.scene.remove(this.player.camera);
    this.renderer.scene.remove(this.particles.object3D);
    this.particles.dispose();
    this.renderer.scene.remove(this.breakOverlay.object3D);
    this.breakOverlay.dispose();
    this.viewModel.dispose();
    this.audio.dispose();
    this.world.setTrackedTarget(null);
    this.world.dispose();
    this.renderer.dispose();
    this.chunkMaterial.dispose();
    this.waterMaterial.dispose();
    this.atlas.texture.dispose();
    this.iconRenderer.dispose();
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
      ...(this.gameMode === GameMode.SURVIVAL
        ? { inventory: this.player.inventory.serialize() }
        : {}),
    };
    const save: WorldSave = {
      metadata,
      overrides: this.world.getOverrides(),
    };
    await this.worldStorage.saveWorld(save);
  }

  /** Apply settings live (FOV, mouse sensitivity, invertY, render distance, show FPS). */
  applySettings(settings: Settings): void {
    this.player.setFov(settings.fov);
    this.renderer.setFogFar(settings.renderDistance * CHUNK_SIZE);
    this.world.setRenderDistance(settings.renderDistance);
    this.controls.setSensitivityScale(settings.mouseSensitivity);
    this.controls.setInvertY(settings.invertY);
    this.audio.setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume);
    this.hud.setShowFps(settings.showFps);
  }

  /** True iff pointer-locked (in active gameplay). */
  isLocked(): boolean {
    return this.controls.isLocked;
  }

  /** True while the death overlay is up (health hit 0, awaiting respawn). */
  isDeadState(): boolean {
    return this.isDead;
  }

  /** Re-acquire pointer lock (called from a user-gesture handler like Resume button). */
  requestPointerLock(): void {
    this.controls.lock();
    this.audio.resume();
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
      (p) => new Chicken(p),
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

  /** Central player-damage path shared by zombie bites and fall damage. Survival callers only. Triggers the death overlay at 0 HP. */
  private damagePlayer(amount: number): void {
    if (this.isDead) return;
    this.player.state.health = Math.max(0, this.player.state.health - amount);
    this.timeSinceLastDamage = 0;
    this.healthRegenAcc = 0;
    this.hud.flashDamage();
    this.audio.playHurt();
    if (this.player.state.health <= 0) {
      this.isDead = true;
      this.controls.unlock();
      this.onDeath();
    }
  }

  /** Per-fixed-step (survival only): track the fall apex while airborne; on landing, damage for blocks fallen past the safe threshold. */
  private updateFallDamage(wasOnGround: boolean): void {
    if (this.gameMode !== GameMode.SURVIVAL) return;
    if (this.respawnInvuln > 0) return;
    const st = this.player.state;
    if (!st.onGround) {
      if (st.position.y > this.fallPeakY) this.fallPeakY = st.position.y;
      return;
    }
    if (!wasOnGround) {
      const fallDist = this.fallPeakY - st.position.y;
      const over = Math.floor(fallDist) - FALL_DAMAGE_SAFE_BLOCKS;
      if (over > 0) this.damagePlayer(over * FALL_DAMAGE_PER_BLOCK);
    }
    // Grounded: keep the baseline pinned to the current height.
    this.fallPeakY = st.position.y;
  }

  /** Per-fixed-step (survival only): accumulate activity exhaustion, convert to hunger loss, and apply starvation damage at 0 hunger (never below STARVE_FLOOR_HP). */
  private updateHunger(wasOnGround: boolean): void {
    if (this.isDead) return;
    const st = this.player.state;
    this.exhaustion += EXHAUSTION_IDLE_PER_S * FIXED_DT;
    const dist = Math.hypot(st.velocity.x, st.velocity.z) * FIXED_DT;
    const rate = this.controls.input.sprint ? EXHAUSTION_SPRINT_PER_BLOCK : EXHAUSTION_WALK_PER_BLOCK;
    this.exhaustion += dist * rate;
    if (wasOnGround && !st.onGround && st.velocity.y > 0) this.exhaustion += EXHAUSTION_JUMP;
    while (this.exhaustion >= EXHAUSTION_PER_HUNGER) {
      this.exhaustion -= EXHAUSTION_PER_HUNGER;
      if (st.hunger > 0) st.hunger -= 1;
    }
    if (st.hunger <= 0) {
      st.hunger = 0;
      this.starveTimer += FIXED_DT;
      if (this.starveTimer >= STARVE_INTERVAL_S) {
        this.starveTimer = 0;
        if (st.health > STARVE_FLOOR_HP) {
          this.damagePlayer(Math.min(STARVE_DAMAGE, st.health - STARVE_FLOOR_HP));
        }
      }
    } else {
      this.starveTimer = 0;
    }
  }

  /** Per-frame (survival only): after HEALTH_REGEN_DELAY_S without damage, restore one half-heart per HEALTH_REGEN_INTERVAL_S up to full. */
  private updateHealthRegen(dt: number): void {
    if (this.gameMode !== GameMode.SURVIVAL) return;
    if (this.isDead) return;
    this.timeSinceLastDamage += dt;
    const st = this.player.state;
    if (st.health >= PLAYER_MAX_HEALTH) {
      this.healthRegenAcc = 0;
      return;
    }
    if (this.timeSinceLastDamage < HEALTH_REGEN_DELAY_S) return;
    if (st.health < PLAYER_MAX_HEALTH && this.player.state.hunger < HUNGER_REGEN_THRESHOLD) {
      this.healthRegenAcc = 0;
      return;
    }
    this.healthRegenAcc += dt;
    while (this.healthRegenAcc >= HEALTH_REGEN_INTERVAL_S && st.health < PLAYER_MAX_HEALTH) {
      st.health += 1;
      this.healthRegenAcc -= HEALTH_REGEN_INTERVAL_S;
      this.exhaustion += EXHAUSTION_PER_HEAL;
    }
    if (st.health >= PLAYER_MAX_HEALTH) this.healthRegenAcc = 0;
  }

  /** True when the player's eye/head voxel is water. Drives drowning (survival) and the underwater overlay (all modes). */
  private isHeadSubmerged(): boolean {
    const st = this.player.state;
    return this.world.getBlock(
      Math.floor(st.position.x),
      Math.floor(st.position.y + PLAYER_EYE),
      Math.floor(st.position.z),
    ) === BlockId.WATER;
  }

  /** Per-frame (survival only): deplete air while the head block is WATER; once empty, apply DROWN_DAMAGE every DROWN_INTERVAL_S. Air snaps back to full on surfacing. */
  private updateBreath(dt: number): void {
    if (this.gameMode !== GameMode.SURVIVAL) return;
    if (this.isDead) return;
    if (this.respawnInvuln > 0) return;
    const submerged = this.isHeadSubmerged();
    if (submerged) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this.drownAcc += dt;
        while (this.drownAcc >= DROWN_INTERVAL_S) {
          this.damagePlayer(DROWN_DAMAGE);
          this.drownAcc -= DROWN_INTERVAL_S;
          if (this.isDead) {
            this.drownAcc = 0;
            return;
          }
        }
      }
    } else {
      this.air = PLAYER_MAX_AIR_S;
      this.drownAcc = 0;
    }
  }

  /** Per-fixed-step (survival only): zombies in range bite the player; death triggers the death overlay. */
  private applyHostileContact(dt: number): void {
    if (this.isDead) return;
    if (this.gameMode !== GameMode.SURVIVAL) return;
    if (this.respawnInvuln > 0) {
      this.respawnInvuln = Math.max(0, this.respawnInvuln - dt);
      return;
    }
    const p = this.player.state.position;
    for (const e of this.world.entityManager.all) {
      if (!(e instanceof Zombie)) continue;
      const dx = e.position.x - p.x;
      const dz = e.position.z - p.z;
      const dy = e.position.y - p.y;
      if (Math.abs(dy) > 2) continue;
      if (dx * dx + dz * dz > ZOMBIE_ATTACK_RANGE * ZOMBIE_ATTACK_RANGE) continue;
      if (e.tryBite()) {
        this.damagePlayer(ZOMBIE_ATTACK_DAMAGE);
        if (this.isDead) return;
      }
    }
  }

  /** Reset to a fresh dry spawn at full health with brief invulnerability. MUTATES position/velocity in place (World holds a live ref). */
  private respawnPlayer(): void {
    const spawn = findDrySpawn(this.world);
    const p = this.player.state.position;
    p.x = spawn.x;
    p.y = spawn.y;
    p.z = spawn.z;
    this.fallPeakY = spawn.y;
    this.timeSinceLastDamage = 0;
    this.healthRegenAcc = 0;
    this.air = PLAYER_MAX_AIR_S;
    this.drownAcc = 0;
    const v = this.player.state.velocity;
    v.x = 0;
    v.y = 0;
    v.z = 0;
    this.player.state.onGround = true;
    this.player.state.health = PLAYER_MAX_HEALTH;
    this.player.state.hunger = PLAYER_MAX_HUNGER;
    this.exhaustion = 0;
    this.starveTimer = 0;
    this.eatProgress = 0;
    this.respawnInvuln = PLAYER_RESPAWN_INVULN_S;
  }

  /** Public entry from the death screen's Respawn button. Resets the player and re-enables hostile contact. */
  respawn(): void {
    this.respawnPlayer();
    this.isDead = false;
  }

  /** Per-fixed-step: turn each skeleton's queued shot (tryFire) into a live Arrow entity. */
  private updateSkeletonFire(): void {
    for (const e of this.world.entityManager.all) {
      if (!(e instanceof Skeleton)) continue;
      const shot = e.tryFire();
      if (shot !== null) {
        this.world.entityManager.spawn(new Arrow(shot.origin, shot.dir));
      }
    }
  }

  /**
   * Per-fixed-step: arrows that overlap the player deal damage (survival only, respecting
   * respawn invulnerability) and are consumed; any arrow flagged dead (block hit, expired
   * lifetime, or player hit) is despawned. respawnInvuln is owned by applyHostileContact —
   * we only read it here.
   */
  private updateArrows(): void {
    const p = this.player.state.position;
    const minX = p.x - PLAYER_RADIUS - ARROW_HIT_RADIUS;
    const maxX = p.x + PLAYER_RADIUS + ARROW_HIT_RADIUS;
    const minY = p.y - ARROW_HIT_RADIUS;
    const maxY = p.y + PLAYER_HEIGHT + ARROW_HIT_RADIUS;
    const minZ = p.z - PLAYER_RADIUS - ARROW_HIT_RADIUS;
    const maxZ = p.z + PLAYER_RADIUS + ARROW_HIT_RADIUS;
    const canHurt = this.gameMode === GameMode.SURVIVAL && !this.isDead && this.respawnInvuln <= 0;

    for (const e of this.world.entityManager.all) {
      if (!(e instanceof Arrow)) continue;
      if (!e.dead) {
        const a = e.position;
        if (a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY && a.z >= minZ && a.z <= maxZ) {
          e.dead = true; // arrow is consumed on impact regardless of game mode
          if (canHurt) {
            this.damagePlayer(ARROW_DAMAGE);
          }
        }
      }
      if (e.dead) {
        this.world.entityManager.despawn(e.id);
      }
    }
  }

  /**
   * Per-fixed-step (survival only): collect dropped items. Despawns items flagged dead
   * (lifetime expired). For pickup-eligible items within DROPPED_ITEM_PICKUP_RADIUS of the
   * player's chest, funnels the stack into the inventory; fully-absorbed items despawn,
   * partially-absorbed items keep the leftover count (inventory full).
   */
  private updateDroppedItems(): void {
    if (this.gameMode !== GameMode.SURVIVAL) return;
    const p = this.player.state.position;
    const cx = p.x;
    const cy = p.y + 0.8;
    const cz = p.z;
    const r2 = DROPPED_ITEM_PICKUP_RADIUS * DROPPED_ITEM_PICKUP_RADIUS;
    for (const e of this.world.entityManager.all) {
      if (!(e instanceof DroppedItem)) continue;
      if (e.dead) {
        this.world.entityManager.despawn(e.id);
        continue;
      }
      if (!e.canPickup()) continue;
      const dx = e.position.x - cx;
      const dy = e.position.y - cy;
      const dz = e.position.z - cz;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      const leftover = this.player.inventory.add(e.item, e.count);
      if (leftover <= 0) {
        this.world.entityManager.despawn(e.id);
      } else {
        e.count = leftover;
      }
    }
  }

  /** Frame-rate, throttled: spawn zombies + skeletons at night near the player up to their caps; despawn all hostiles + arrows at dawn. */
  private updateHostiles(dt: number): void {
    if (!this.dayNight.isNight) {
      // Despawn once, on the night->day transition — not every daytime frame.
      if (this.wasNight) {
        for (const e of this.world.entityManager.all) {
          if (e instanceof Zombie || e instanceof Skeleton || e instanceof Arrow) {
            this.world.entityManager.despawn(e.id);
          }
        }
        this.hostileSpawnAcc = 0;
      }
      this.wasNight = false;
      return;
    }
    this.wasNight = true;
    this.hostileSpawnAcc += dt;
    if (this.hostileSpawnAcc < HOSTILE_SPAWN_INTERVAL_S) return;
    this.hostileSpawnAcc = 0;

    let zombies = 0;
    let skeletons = 0;
    for (const e of this.world.entityManager.all) {
      if (e instanceof Zombie) zombies++;
      else if (e instanceof Skeleton) skeletons++;
    }

    if (zombies < ZOMBIE_MAX_COUNT) {
      const s = this.findHostileSpawn();
      if (s !== null) this.world.entityManager.spawn(new Zombie({ x: s.x + 0.5, y: s.y + 1, z: s.z + 0.5 }));
    }
    if (skeletons < SKELETON_MAX_COUNT) {
      const s = this.findHostileSpawn();
      if (s !== null) this.world.entityManager.spawn(new Skeleton({ x: s.x + 0.5, y: s.y + 1, z: s.z + 0.5 }));
    }
  }

  /** Pick a valid hostile spawn cell on the ground in a ring around the player, or null if none found. Returns integer block coords (sx, topSolidY, sz). */
  private findHostileSpawn(): { x: number; y: number; z: number } | null {
    const px = this.player.state.position.x;
    const pz = this.player.state.position.z;
    for (let attempt = 0; attempt < HOSTILE_SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist =
        HOSTILE_SPAWN_MIN_RADIUS +
        Math.random() * (HOSTILE_SPAWN_MAX_RADIUS - HOSTILE_SPAWN_MIN_RADIUS);
      const sx = Math.floor(px + Math.cos(angle) * dist);
      const sz = Math.floor(pz + Math.sin(angle) * dist);
      const sy = topSolidY(this.world, sx, sz);
      if (sy < 0) continue;
      if (this.world.getBlock(sx, sy + 1, sz) !== BlockId.AIR) continue;
      if (this.world.getBlock(sx, sy + 2, sz) !== BlockId.AIR) continue; // head clearance
      return { x: sx, y: sy, z: sz };
    }
    return null;
  }

  /**
   * Per-frame hold-to-mine. Accumulates time on the crosshair-targeted block and breaks it
   * once progress reaches its hardness. Survival mines by hardness; creative breaks instantly
   * (mineTotal 0). Resets when the pointer unlocks, the button is released, the target changes,
   * or a mob is in melee reach (melee takes priority). Keeps mining the next block while held.
   */
  private updateMining(dt: number): void {
    if (this.isDead || !this.controls.isLocked || !this.leftHeld) {
      this.resetMining();
      return;
    }
    if (this.findMeleeTarget() !== null) {
      this.resetMining();
      return;
    }
    const target = this.interaction.getTargetedBlock();
    if (target === null || target.block === BlockId.BEDROCK || target.block === BlockId.AIR) {
      this.resetMining();
      return;
    }
    const key = target.x + ',' + target.y + ',' + target.z;
    if (key !== this.mineTargetKey) {
      this.mineTargetKey = key;
      this.mineProgress = 0;
    }
    // Recompute every frame so swapping to/from a tool mid-mine updates the speed
    // immediately. The target key is unchanged on a swap, so progress is preserved.
    const heldItem = this.player.inventory.getSlot(this.player.state.selectedSlot)?.item ?? BlockId.AIR;
    this.mineTotal = this.gameMode === GameMode.CREATIVE
      ? 0
      : blockRegistry.get(target.block).hardness / toolMultiplierFor(heldItem, target.block);
    this.mineProgress += dt;
    const frac = this.mineTotal <= 0 ? 1 : Math.min(1, this.mineProgress / this.mineTotal);
    this.hud.setBreakProgress(frac);
    this.viewModel.setMining(true);
    if (this.mineTotal > 0) {
      this.breakOverlay.show(target.x, target.y, target.z, frac);
    }
    if (this.mineProgress >= this.mineTotal) {
      const broken = this.interaction.breakBlockAt(target.x, target.y, target.z);
      if (broken !== null) {
        const color = blockRegistry.get(broken.block).particleColor;
        this.particles.spawnBurst(broken.x + 0.5, broken.y + 0.5, broken.z + 0.5, color);
        this.audio.playBreak();
        if (this.gameMode === GameMode.SURVIVAL) {
          this.world.entityManager.spawn(
            new DroppedItem(
              { x: broken.x + 0.5, y: broken.y + 0.3, z: broken.z + 0.5 },
              blockDropFor(broken.block),
              1,
            ),
          );
        }
      }
      // Reset progress; keep mining the next block under the crosshair while still held.
      this.mineProgress = 0;
      this.mineTotal = 0;
      this.mineTargetKey = null;
      this.hud.setBreakProgress(0);
      this.breakOverlay.hide();
    }
  }

  /** Per-frame (survival only): hold right-click on a food item to eat it after EAT_DURATION_S, restoring hunger and consuming one. */
  private updateEating(dt: number): void {
    if (this.gameMode !== GameMode.SURVIVAL || this.isDead || this.inventoryScreen.isOpen) {
      this.eatProgress = 0;
      return;
    }
    const slot = this.player.state.selectedSlot;
    const item = this.player.inventory.getSlot(slot)?.item ?? null;
    const food = item === null ? null : itemFoodDef(item);
    if (!this.rightHeld || food === null || this.player.state.hunger >= PLAYER_MAX_HUNGER) {
      this.eatProgress = 0;
      return;
    }
    this.eatProgress += dt;
    if (this.eatProgress >= EAT_DURATION_S) {
      this.eatProgress = 0;
      this.player.state.hunger = Math.min(PLAYER_MAX_HUNGER, this.player.state.hunger + food.hungerRestore);
      this.player.inventory.removeOne(slot);
      this.viewModel.triggerSwing();
    }
  }

  /** Clear mining progress + hide the HUD disc + stop the continuous arm swing. */
  private resetMining(): void {
    this.mineProgress = 0;
    this.mineTotal = 0;
    this.mineTargetKey = null;
    this.hud.setBreakProgress(0);
    this.breakOverlay.hide();
    this.viewModel.setMining(false);
  }

  /**
   * Closest Mob whose center lies within PLAYER_ATTACK_RANGE of the eye AND inside a
   * ~35° cone around the camera's forward direction. Null if nothing is in reach/sight.
   */
  private findMeleeTarget(): Mob | null {
    const eye = this.player.camera.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.player.camera.quaternion)
      .normalize();
    const cosCone = Math.cos((35 * Math.PI) / 180);
    let best: Mob | null = null;
    let bestDist = Infinity;
    for (const e of this.world.entityManager.all) {
      if (!(e instanceof Mob)) continue;
      const dx = e.position.x - eye.x;
      const dy = e.position.y + e.height * 0.5 - eye.y; // aim at vertical center
      const dz = e.position.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > PLAYER_ATTACK_RANGE || dist < 1e-4) continue;
      const alignment = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist; // cos(angle to crosshair)
      if (alignment < cosCone) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    return best;
  }

  /**
   * If a mob is in melee reach/sight, swing at it (cooldown-gated) and return true so the
   * click is consumed (no block break). Returns false when no mob is targeted, letting the
   * caller fall back to breaking a block. Works in both game modes.
   */
  private tryMeleeAttack(): boolean {
    const target = this.findMeleeTarget();
    if (target === null) return false;
    if (this.playerAttackCooldown > 0) {
      // Survival eats the click so you don't accidentally mine terrain mid-fight;
      // Creative falls through to break the block behind the mob (building takes priority).
      return this.gameMode === GameMode.SURVIVAL;
    }
    this.playerAttackCooldown = PLAYER_ATTACK_COOLDOWN_S;
    this.audio.playAttack();
    const p = this.player.state.position;
    const killed = target.takeDamage(PLAYER_ATTACK_DAMAGE, p.x, p.z);
    if (killed) {
      if (this.gameMode === GameMode.SURVIVAL) {
        const drop = foodDropForMob(target.kind);
        if (drop !== null) {
          const mp = target.position;
          this.world.entityManager.spawn(new DroppedItem({ x: mp.x, y: mp.y + 0.3, z: mp.z }, drop, 1));
        }
      }
      this.world.entityManager.despawn(target.id);
    }
    return true;
  }
}
