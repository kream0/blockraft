# Blockraft

A 3D Minecraft-style voxel game built with **Bun + Three.js + TypeScript (strict)**, served by Vite.

> Built collaboratively with Claude Code using a multi-agent workflow (contract → parallel implementers → integration → reviewer → fix → smoke test). See [`CLAUDE.md`](./CLAUDE.md) for the full process.

---

<img width="1920" height="951" alt="image" src="https://github.com/user-attachments/assets/a3920093-cbee-4877-9690-0caf217ac5bf" />


## Current features

### World
- Chunked voxel world (16×96×16 chunks) with face-culled meshing — **built off the main thread in a Web Worker**: a padded block "halo" is transferred to the worker, which returns typed-array geometry buffers (with a global-version staleness check so an unloaded/reloaded chunk never picks up a stale result), so heavy chunk streaming no longer stalls the frame; a synchronous mesher remains as an automatic fallback
- **Ambient occlusion**: chunk meshes bake per-vertex AO, so block crevices, ledges, and the ground beneath trees pick up soft contact shadows (the classic voxel smooth-lighting look) — opaque blocks occlude, foliage/glass/water don't, and a flip-quad split avoids the diagonal-gradient artifact
- **Sky lighting** (Lighting v1): a per-block sky-light level (0–15) floods straight down open columns, then a 6-neighbour BFS spreads it around corners (attenuating one step per block), so caves, overhangs, and deep interiors sink into shadow while exposed surfaces stay fully lit. The level is baked into per-vertex brightness and recomputed per chunk whenever it meshes, pulling light across borders from loaded neighbours so seams stay smooth; the day/night ambient still scales on top. **Smooth light diffusion**: rather than a flat per-face value, each vertex averages its own light cell with the three plane-neighbour cells already sampled for AO, so a torch (or a cave mouth) fades off across a wall in a smooth gradient instead of tinting whole faces a uniform "white-ish" block. **Block light** (Lighting v2) floods the same way from light-emitting blocks: a placed **torch** emits level-14 light through an independent BFS, kept in a separate per-chunk grid and combined with sky light as `max(sky, block)` only when a chunk meshes — so torches brighten caves, overhangs, and night-time interiors that sky light never reaches. A **glowstone** block is a second emitter: a full opaque block (crafted by compressing 4 torches in a 2×2) that floods the maximum level-15 light through the same BFS (brighter than a torch), so you can build it into walls and ceilings as a permanent light source. Emitted block light is added as a **warm firelight-orange emissive** (independent of the day/night sun), so torch-lit interiors glow amber while sky-lit surfaces stay neutral.
- Procedural terrain via Perlin FBM heightmap
- Trees placed deterministically per chunk (Plains only)
- **Biomes**: a low-frequency biome map skins the surface into grassy **Plains**, sandy **Desert**, and snow-capped **Snowy** regions (deterministic per seed; heightmap unchanged)
- **Mountains**: an independent low-frequency elevation mask (smoothstep-ramped) raises whole regions far above the lowlands, adding up to 32 blocks of height purely on top of the base heightmap. High slopes expose bare **stone**, and peaks above the snow line cap with **snow** — overriding the biome skin at altitude, with solid rock filling the columns beneath (deterministic per seed; lowlands stay untouched)
- Sea level + water bodies; translucent water rendering (multi-mesh per chunk)
- **Ore veins**: Coal, Iron, and Diamond scatter through stone as deterministic random-walk veins — coal up to mid-depth (y≤50), iron deep only (y≤28), and **diamond** deepest of all (y≤12); only replaces stone and never touches bedrock
- **Caves**: underground cave systems carved from a 3D fractal-noise iso-band (`|n| < threshold`) in world coordinates, so caverns connect seamlessly across chunk borders; only stone becomes air (~15–19% carved), leaving the surface skin, bedrock, water, and ore intact (deterministic per seed; carved before ore so veins stay embedded)
- **Structure generation** (v1): deterministic per-chunk structures stamped after ores — surface **boulders** (rounded cobblestone mounds on land above sea level), buried **dungeon rooms** (a cobblestone-shell chamber a few blocks under the surface with an embedded **iron-ore** reward and a **loot chest**), and small **villages** (clusters of 1–2 plank huts with log corner posts, glass windows, and a **closed door** hung in the doorway, raised on flat dry ground). Confined to the chunk interior so a structure never spans a border (deterministic per seed)
- **Dungeon loot chests**: every generated dungeon embeds a **chest pre-filled with a deterministic loot roll** (3–6 weighted stacks drawn from iron, cooked food, sticks, planks, stone/iron tools, an iron sword, diamonds, and iron armor). The roll is a pure function of the world seed and the chest's coordinates, so a given dungeon always yields the same haul — and the loot is seeded **exactly once per chest**: once you open and empty it, it **stays empty across save/load and export/import** (no refarming). Breaking the chest spills its contents in Survival
- 21 block types: Grass, Dirt, Stone, Cobblestone, Wood, Leaves, Planks, Sand, Snow, Glass, Bedrock, Water, Coal Ore, Iron Ore, Diamond Ore, Furnace, Chest, Door, Torch, Glowstone, Air
- Procedurally generated 16×16 texture atlas (no external image assets)

### Gameplay
- First-person controls (WASD + mouse look + jump + sprint)
- AABB physics with per-axis swept collision (Y → X → Z) and gravity
- **Progressive mining**: hold left-click to break a block — mining time scales with the block's hardness (dirt is quick, stone slower, ore tougher, bedrock unbreakable), shown by a radial progress ring on the crosshair **and a Minecraft-style destroy-stage crack overlay that deepens on the block itself** (10 cumulative stages); releasing or looking away cancels. Creative mode breaks instantly.
- **First-person hand**: a camera-attached view-model arm that swings when you mine, attack, or place, and **shows the item you're holding** — the selected hotbar item appears as a 3D model gripped in the hand (empty-handed when the slot is empty). Most blocks hold as a textured cube, but the **torch renders as a slim vertical post** (not a full block) both in-hand and as its hotbar/inventory icon, so it reads as a thin torch with empty space around it
- DDA voxel raycasting picks the block under the crosshair for break/place
- 9-slot hotbar with number-key selection
- Block-break particle bursts tinted to the broken block's color
- Edits persist per-world; reload your world and your changes are still there
- **Block updates**: world edits trigger cascading reactions — unsupported **sand falls** and settles onto the first solid block below it; **leaves decay** to air when no log remains within 6 connected blocks (chop a tree's trunk and its canopy clears). A single edit's whole cascade is batched into one remesh per affected chunk

### Mobs & combat
- Passive animals roam the world: **Cow**, **Pig**, **Sheep**, **Chicken** — each a distinct procedural block mesh
- Wander AI: alternate between strolling in a random heading and standing idle
- A small herd spawns on dry ground around you when a world loads
- **Hostile Zombies** spawn at night near the player (capped), chase you, and despawn at dawn
- **Hostile Skeletons** also spawn at night: a ranged mob that range-band kites the player (keeps its distance) and fires **arrows** on cooldown when line-of-sight is clear; arrows fly straight and deal contact damage in Survival
- Melee combat: left-click swings at a mob within a forward cone/range (cooldown-gated), **dealing more damage when you're holding a sword**; zombies bite back for contact damage in Survival
- Full entity lifecycle: fixed-step physics, gravity, AABB collision, GPU-resource disposal
- **Terrain step-climbing**: every mob — animals and hostiles alike — hops a 1-block ledge in its path via a shared step-up, so herds and pursuers walk up slopes instead of getting stuck
- **Ledge/edge avoidance**: the same shared locomotion also vetoes a step that would walk a mob off a drop taller than 3 blocks — wandering animals turn away from cliffs and deep water, and chasers/skeletons stop at the brink instead of suiciding off it (no pathfinding yet — they won't route around the gap)

### Survival
- Health bar with damage from zombie bites, fall damage, and drowning (Survival mode only)
- **Hunger bar** (Survival only): a 10-icon drumstick meter beside the hearts, drained by an *exhaustion* model — walking, sprinting, jumping, and healing all cost hunger. Eat to refill by holding right-click with food selected. Not persisted (resets full each load)
- Air/breath meter with an underwater screen overlay; drowning damage once air runs out
- Passive health regeneration after a short no-damage delay, now gated on a near-full hunger bar; at zero hunger you starve for half a heart at a time (but never below 1 HP)
- Death overlay with respawn at a fresh dry spawn (brief post-respawn invulnerability)
- Creative mode is damage-free

### Items & inventory
- **Item economy** (Survival): mining a block drops a collectible item that pops out, settles, then magnetically vacuums to you and stacks into your inventory; placing a block consumes one from the selected hotbar slot. **Mining stone yields cobblestone** (as in Minecraft), making it gatherable and feeding stone-tool crafting
- **Food drops** (Survival): killing a passive animal drops raw food — cow → raw beef, pig → raw porkchop, chicken → raw chicken, sheep → raw mutton — each a stackable item that refills hunger when eaten
- Items generalize beyond blocks: **sticks**, **iron ingots**, **diamonds**, **tools in four tiers** — **wooden, stone, iron + diamond** (pickaxe / axe / shovel each) — and **swords in those same four tiers** are first-class items, each rendered from its own **3D mesh model** (stone variants share the wood silhouette with a grey head; iron a pale steel head; diamond a cyan gem head), with their own stack sizes
- 36-slot inventory model (9 hotbar + 27 backpack); every slot renders a **live 3D item icon** (blocks as isometric cubes, tools as their 3D models) with stack count, and the inventory persists per-world
- **Inventory & crafting screen** (both modes): press **E** to open a grid of all 36 slots alongside a 3×3 crafting grid; rearrange with a held cursor stack — left-click picks up / drops / merges / swaps, right-click splits a stack in half or drops one; close with **E** or **Esc** (gameplay soft-pauses while it's open)
- **Crafting**: fill the 3×3 grid to match a recipe (shaped or shapeless) — wood → planks, planks → sticks, planks + sticks → wooden tools, **cobblestone + sticks → stone tools**, and **diamonds + sticks → diamond tools, swords, and armor**; the result previews live in the output slot and the inputs are consumed when you take it
- **Tools speed up mining**: holding the right tool shortens break time per material (pickaxe for stone/ore, axe for wood/planks, shovel for dirt/grass/sand/snow), and **diamond tools mine faster than iron, which mine faster than stone, which mine faster than wood**
- **Swords boost melee damage**: holding a sword raises your hit above the bare-fist baseline — **wooden < stone < iron < diamond** — so a diamond sword hits hardest while fists take several swings. Crafted like the other tools (two of the tier material stacked over a stick)
- **Armor** (Survival): craft a **helmet, chestplate, leggings, and boots** in two tiers — from **iron ingots** or, for the toughest protection, from **diamonds** — then **right-click** a piece to wear it in its body slot (any piece already worn there swaps back to your hotbar). Worn armor shows as a shield meter above the hearts and **soaks up a share of incoming combat and fall damage** (more and stronger pieces = more protection, up to a cap; a full diamond set reaches the cap) while leaving starvation and drowning at full bite; it persists per-world through save/load and stays on through death and respawn
- **Smelting** (both modes): craft a **Furnace** (a ring of 8 cobblestone) and place it, then **right-click** it to open a 3-slot smelting screen (input · fuel · output). Fuel — **coal, wood, planks, or sticks** (coal lasts longest) — burns to smelt the input over time: **iron ore → iron ingot**, **sand → glass**, **cobblestone → stone**, and **raw food → cooked food** (cooking more than doubles the hunger it restores). The flame gauge and progress arrow animate live, smelting keeps running while the screen is open, and **each furnace's contents persist per-world**. Iron ingots feed the **iron tool tier**; breaking a furnace drops it (and spills its contents) in Survival
- **Storage chests** (both modes): craft a **Chest** (a ring of 8 planks) and place it, then **right-click** it to open a 27-slot storage grid above your inventory — move stacks with the held cursor (left-click to pick up / drop / merge, right-click to split, shift-click to transfer) exactly like the inventory screen. Each chest's contents persist per-world, and **breaking a chest spills its contents** in Survival
- **Doors** (both modes): craft **3 doors** from a 2×3 block of **planks**, then place one to raise a **2-tall swinging door** in a single-block gap. It takes its facing from the way you're looking, and **right-clicking swings it open or closed** — both halves move together. An open door is walk-through; a closed one blocks you (and seals the hut). Breaking either half removes the whole door and returns one door item in Survival. **Village huts now come with a door already hung**
- Creative keeps an infinite pre-filled block palette — no drops, no consumption, no counts — but crafting works from palette items too

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
  - **Rebindable controls**: remap move / jump / sprint / inventory keys — click a binding then press the new key; conflicts **swap** so no key is ever doubled or left empty, and pressing a reserved key (hotbar digits) or **Esc** cancels. Bindings persist per the usual settings store and live-apply instantly

### Persistence
- Worlds saved to **IndexedDB** (metadata + sparse chunk overrides)
- Settings saved to **LocalStorage** (debounced writes)
- Per-world deterministic seed derived from world name (FNV-1a hash + xorshift mix)
- Auto-save every 30s and on quit-to-menu
- **World import/export**: from the world list, **Export** any world to a downloadable `*.blockraft.json` file (metadata + chunk overrides + furnace, chest, and dungeon-loot state) or **Import** one back from disk. The file is validated at the boundary — malformed or foreign files are rejected, recoverable fields fall back to safe defaults — and an import is auto-renamed on name collision so it never overwrites an existing world

### Foundations (in place, not yet user-facing)
- **Network adapter**: `INetworkAdapter` interface + `LocalAdapter` no-op stub; typed message protocol (entity spawn/despawn/state, block set, chat, hello/welcome handshake)
- **Remote player entity** (visual stub) ready for multiplayer rendering

---

## Upcoming features

### Short term
- **Hunger polish**: a hidden saturation layer and cooked-food items — the core hunger bar (exhaustion drain, health-regen gating, starvation, raw-food drops, hold-to-eat) already ships (see Survival above)
- **Mob AI improvements**: pathfinding and smarter target tracking — 1-block step-climbing and cliff/edge avoidance already ship (see Mobs & combat above)
- **A wider recipe book**: more crafting + smelting recipes — the crafting grid, **wooden / stone / iron / diamond tools and swords**, **iron + diamond armor** (helmet / chestplate / leggings / boots), and **smelting via the furnace** (ore→ingot, sand→glass, cobble→stone, raw→cooked food) already ship (see Items & inventory above)

### Medium term
- **Multiplayer (real)**: WebSocket server + `WebSocketAdapter implements INetworkAdapter`. Entity sync + block sync + chat already typed in `NetworkMessage`.
- **Lighting (more emitters / colored light)**: **lava** as an emitter and per-emitter *colored* light are the remaining work — **block light** (Lighting v2: a craftable **torch** at level-14 plus a **glowstone** block at level-15, both flooding through the same BFS and combined with sky light at mesh time, rendered as a **warm firelight-orange emissive**), **smooth per-vertex light diffusion** (each vertex averages its neighbour light cells so light fades off in a gradient rather than tinting whole faces), **per-block sky light** (Lighting v1: a BFS sky-light flood baked into vertex brightness so caves darken), and vertex ambient occlusion / smooth contact shading all already ship (see World above)
- **Mob spawning rules**: night-time hostile spawns, light-level checks, biome-specific spawns
- **Block updates**: water flow — sand falling + leaf decay already ship (see Gameplay above)
- **Structure generation (more)**: larger multi-chunk village layouts and more structure variety — v1 boulders, dungeon rooms (iron reward **+ a deterministic loot chest**), single-chunk villages, and **structure-placed loot chests** already ship (see World above); the **Chest** block also ships as a craftable storage container (see Items & inventory)
- **Chunk LOD**: distance-based level of detail for far chunks — async meshing in a Web Worker already ships (see World above)

### Long term / nice-to-haves
- **Custom resource packs**: swap the procedural texture atlas for user-supplied PNGs
- **Shaders**: ambient occlusion, screen-space fog, post-processing
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
| **Right click** | Place block, or open a door / chest / furnace |
| **1–9** | Select hotbar slot |
| **E** | Open / close inventory & crafting |
| **Esc** | Pause menu (release pointer) |

> Movement, jump, sprint, and the inventory key are **rebindable** in Settings → Controls. Hotbar digits (1–9) and **Esc** stay fixed.

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
