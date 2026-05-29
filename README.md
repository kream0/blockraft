# Blockraft

A 3D Minecraft-style voxel game built with **Bun + Three.js + TypeScript (strict)**, served by Vite.

> Built collaboratively with Claude Code using a multi-agent workflow (contract → parallel implementers → integration → reviewer → fix → smoke test). See [`CLAUDE.md`](./CLAUDE.md) for the full process.

---

<img width="1920" height="951" alt="image" src="https://github.com/user-attachments/assets/a3920093-cbee-4877-9690-0caf217ac5bf" />


## Current features

### World
- Chunked voxel world (16×96×16 chunks) with face-culled meshing
- Procedural terrain via Perlin FBM heightmap
- Trees placed deterministically per chunk
- Sea level + water bodies; translucent water rendering (multi-mesh per chunk)
- 12 block types: Grass, Dirt, Stone, Cobblestone, Wood, Leaves, Planks, Sand, Glass, Bedrock, Water, Air
- Procedurally generated 16×16 texture atlas (no external image assets)

### Gameplay
- First-person controls (WASD + mouse look + jump + sprint)
- AABB physics with per-axis swept collision (Y → X → Z) and gravity
- DDA voxel raycasting for break/place actions
- 9-slot hotbar with number-key selection
- Edits persist per-world; reload your world and your changes are still there

### Mobs
- Passive animals roam the world: **Cow**, **Pig**, **Sheep** — each a distinct procedural block mesh
- Wander AI: alternate between strolling in a random heading and standing idle
- A small herd spawns on dry ground around you when a world loads
- Full entity lifecycle: fixed-step physics, gravity, AABB collision, GPU-resource disposal

### Audio
- Procedural sound effects synthesized at runtime with the Web Audio API — **no audio files**
- Cues for block break / place, melee swing, and taking damage, each built from oscillators + filtered noise bursts
- **Master** and **SFX** volume sliders are live; the **Music** bus is wired and reserved for a future ambient track

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
- **Hostile-mob reference**: a wandering `Zombie` class kept as the template for future hostile AI

---

## Upcoming features

### Short term
- **Survival mechanics**: health, hunger, day/night cycle, mob damage
- **More mobs**: Skeleton (hostile, ranged); Chicken (passive)
- **Mob AI improvements**: pathfinding, target tracking, jump-over-obstacle behavior
- **Inventory UI**: full inventory grid + crafting (recipes for planks, sticks, tools)
- **Tools**: pickaxe / axe / shovel with break-time speedups per material
- **Ambient music**: a procedural ambient track on the existing Music volume bus (sound effects are already implemented — see Audio above)
- **Show FPS toggle**: wire the existing setting to actually hide/show the HUD readout
- **Biomes**: desert, snowy, forest variants by noise selection

### Medium term
- **Multiplayer (real)**: WebSocket server + `WebSocketAdapter implements INetworkAdapter`. Entity sync + block sync + chat already typed in `NetworkMessage`.
- **Lighting**: per-block sky/torch lightmap, smooth shading at chunk edges
- **Mob spawning rules**: night-time hostile spawns, light-level checks, biome-specific spawns
- **Block updates**: water flow, sand falling, leaf decay
- **Structure generation**: villages, dungeons, ore veins
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
| **Left click** | Break block |
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
