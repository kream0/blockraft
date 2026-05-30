# Blockraft

A 3D Minecraft-style voxel game built with **Bun + Three.js + TypeScript (strict)**, served by Vite.

> Built collaboratively with Claude Code using a multi-agent workflow (contract → parallel implementers → integration → reviewer → fix → smoke test). See [`CLAUDE.md`](./CLAUDE.md) for the full process.

---

<img width="1920" height="951" alt="image" src="https://github.com/user-attachments/assets/a3920093-cbee-4877-9690-0caf217ac5bf" />


## Current features

### World
- Chunked voxel world (16×96×16 chunks) with face-culled meshing
- Procedural terrain via Perlin FBM heightmap
- Trees placed deterministically per chunk (Plains only)
- **Biomes**: a low-frequency biome map skins the surface into grassy **Plains**, sandy **Desert**, and snow-capped **Snowy** regions (deterministic per seed; heightmap unchanged)
- Sea level + water bodies; translucent water rendering (multi-mesh per chunk)
- **Ore veins**: Coal and Iron scatter through stone as deterministic random-walk veins — coal up to mid-depth (y≤50), iron deep only (y≤28); only replaces stone and never touches bedrock
- **Caves**: underground cave systems carved from a 3D fractal-noise iso-band (`|n| < threshold`) in world coordinates, so caverns connect seamlessly across chunk borders; only stone becomes air (~15–19% carved), leaving the surface skin, bedrock, water, and ore intact (deterministic per seed; carved before ore so veins stay embedded)
- 15 block types: Grass, Dirt, Stone, Cobblestone, Wood, Leaves, Planks, Sand, Snow, Glass, Bedrock, Water, Coal Ore, Iron Ore, Air
- Procedurally generated 16×16 texture atlas (no external image assets)

### Gameplay
- First-person controls (WASD + mouse look + jump + sprint)
- AABB physics with per-axis swept collision (Y → X → Z) and gravity
- **Progressive mining**: hold left-click to break a block — mining time scales with the block's hardness (dirt is quick, stone slower, ore tougher, bedrock unbreakable), shown by a radial progress ring on the crosshair; releasing or looking away cancels. Creative mode breaks instantly.
- **First-person hand**: a camera-attached view-model arm that swings when you mine, attack, or place
- DDA voxel raycasting picks the block under the crosshair for break/place
- 9-slot hotbar with number-key selection
- Block-break particle bursts tinted to the broken block's color
- Edits persist per-world; reload your world and your changes are still there

### Mobs & combat
- Passive animals roam the world: **Cow**, **Pig**, **Sheep**, **Chicken** — each a distinct procedural block mesh
- Wander AI: alternate between strolling in a random heading and standing idle
- A small herd spawns on dry ground around you when a world loads
- **Hostile Zombies** spawn at night near the player (capped), chase you, and despawn at dawn
- **Hostile Skeletons** also spawn at night: a ranged mob that range-band kites the player (keeps its distance) and fires **arrows** on cooldown when line-of-sight is clear; arrows fly straight and deal contact damage in Survival
- Melee combat: left-click swings at a mob within a forward cone/range (cooldown-gated); zombies bite back for contact damage in Survival
- Full entity lifecycle: fixed-step physics, gravity, AABB collision, GPU-resource disposal
- **Terrain step-climbing**: every mob — animals and hostiles alike — hops a 1-block ledge in its path via a shared step-up, so herds and pursuers walk up slopes instead of getting stuck

### Survival
- Health bar with damage from zombie bites, fall damage, and drowning (Survival mode only)
- Air/breath meter with an underwater screen overlay; drowning damage once air runs out
- Passive health regeneration after a short no-damage delay
- Death overlay with respawn at a fresh dry spawn (brief post-respawn invulnerability)
- Creative mode is damage-free

### Day & night
- Continuous day/night cycle driving sky color, sun direction, ambient light, and fog (zero per-frame allocation)
- HUD time-of-day indicator; nightfall brings out the hostiles (time of day is not persisted — each load starts in the morning)

### Audio
- Procedural sound effects synthesized at runtime with the Web Audio API — **no audio files**
- Cues for block break / place, melee swing, and taking damage, each built from oscillators + filtered noise bursts
- **Ambient music**: a continuous, slowly-evolving drone pad — four detuned oscillators on an open A+E chord, each gently swelled by its own slow LFO, synthesized live (no audio files)
- **Master**, **Music**, and **SFX** volume sliders are all live

### Menus & UX
- **Main menu**: Singleplayer, Multiplayer (coming soon), Settings, Quit
- **World list**: load existing worlds with last-played time, mode, seed
- **Create world**: name (validates uniqueness), optional seed, game mode (Survival / Creative)
- **Pause menu** (ESC): Resume / Settings / Save and Quit to Menu
- **Settings** (live-applied during gameplay):
  - Render distance (2–16 chunks)
  - FOV (60–110)
  - Mouse sensitivity (0.25×–3.0×)
  - Master / Music / SFX volumes
  - Invert Y axis
  - Show FPS

### Persistence
- Worlds saved to **IndexedDB** (metadata + sparse chunk overrides)
- Settings saved to **LocalStorage** (debounced writes)
- Per-world deterministic seed derived from world name (FNV-1a hash + xorshift mix)
- Auto-save every 30s and on quit-to-menu

### Foundations (in place, not yet user-facing)
- **Network adapter**: `INetworkAdapter` interface + `LocalAdapter` no-op stub; typed message protocol (entity spawn/despawn/state, block set, chat, hello/welcome handshake)
- **Remote player entity** (visual stub) ready for multiplayer rendering

---

## Upcoming features

### Short term
- **Hunger system**: a hunger/saturation bar that drains over time and gates health regen (health, day/night cycle, and mob damage are already shipped — see Survival / Day & night above)
- **Mob AI improvements**: pathfinding, smarter target tracking, cliff/edge avoidance (1-block step-climbing already ships — see Mobs & combat above)
- **Inventory UI**: full inventory grid + crafting (recipes for planks, sticks, tools)
- **Tools**: pickaxe / axe / shovel with break-time speedups per material

### Medium term
- **Multiplayer (real)**: WebSocket server + `WebSocketAdapter implements INetworkAdapter`. Entity sync + block sync + chat already typed in `NetworkMessage`.
- **Lighting**: per-block sky/torch lightmap, smooth shading at chunk edges
- **Mob spawning rules**: night-time hostile spawns, light-level checks, biome-specific spawns
- **Block updates**: water flow, sand falling, leaf decay
- **Structure generation**: villages, dungeons
- **Chunk LOD or async meshing**: move meshing to a Web Worker

### Long term / nice-to-haves
- **Custom resource packs**: swap the procedural texture atlas for user-supplied PNGs
- **Shaders**: ambient occlusion, screen-space fog, post-processing
- **Save/load JSON export**: import/export world files outside of IndexedDB
- **Mobile / touch controls**
- **WebGPU renderer path** when Three.js's WebGPU backend stabilizes

---

## Setup

```bash
bun install
```

## Commands

| Command | What it does |
|--|--|
| `bun run dev` | Start the Vite dev server (defaults to http://localhost:5173) |
| `bun run build` | Type-check + bundle for production into `dist/` |
| `bun run preview` | Preview the production build |
| `bun run typecheck` | Run TypeScript type checking only |

## Controls

| Input | Action |
|--|--|
| **Click canvas** | Lock pointer (start playing) |
| **WASD** | Move |
| **Space** | Jump |
| **Shift** | Sprint |
| **Mouse** | Look around |
| **Left click (hold)** | Mine / break block (hold to keep mining) |
| **Right click** | Place block |
| **1–9** | Select hotbar slot |
| **Esc** | Pause menu (release pointer) |

---

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for the full project guide:
- Module layout and dependency rules
- TypeScript strict-mode patterns
- Entity / world / persistence boundaries
- Multi-agent development workflow
- Known gotchas

## Tech stack

- **[Three.js](https://threejs.org/)** — WebGL rendering
- **[TypeScript](https://www.typescriptlang.org/)** (strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`)
- **[Bun](https://bun.sh/)** — JavaScript runtime + package manager
- **[Vite](https://vitejs.dev/)** — dev server + production bundler
- **No external image/audio assets** — textures are generated procedurally
