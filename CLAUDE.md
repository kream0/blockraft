# Blockraft — Project Guide for AI Agents

> A Three.js + TypeScript voxel game built with Bun + Vite. This file is loaded automatically by Claude Code (and compatible LLM tools) at the start of every session in this directory.

## Autonomy mandate (CRITICAL — do not wait to be told to continue)

**This is a self-driving development project. The user should NEVER have to say "continue", "next", or "keep going".** Once given a general directive to develop the game, run the full feature lifecycle on a loop, autonomously, until told to stop:

1. **Pick the next feature yourself** — consult the README "Upcoming features" roadmap and the shipped-features list; choose the highest-value, lowest-risk item that fits the existing architecture. The user has explicitly delegated this decision ("I'll let you take the decisions", "you can pick what's next").
2. **Create tasks** (`TaskCreate`) breaking the feature into the agent-workflow phases.
3. **Execute via agents only** — follow the multi-agent workflow below (contract → implementers → integration → review → fix). **Use opus agents, NEVER haiku.** The lead (you) NEVER edits feature code directly; delegate every code change to an implementer agent. (Lead-direct activities ARE allowed: git operations, README/docs edits, research, file reads, running the validation gate, smoke testing.)
4. **Test** — run the validation gate (`bun run typecheck && bun run build`), spawn a READ-ONLY opus reviewer, and smoke-test in browser where possible (state the pointer-lock caveat honestly when gameplay can't be driven).
5. **Commit + push** — commit the feature directly to `main`, then a separate `docs:` commit for README updates, and `git push origin main`. NEVER branch, NEVER open a PR.
6. **Update memory** — run the memorai session-end flow; derive 0–3 beliefs. NEVER stage `.memorai/`.
7. **Loop** — immediately pick the next feature and repeat. Do not stop to ask "what's next?" or "should I proceed?".

**Only pause for the user when:**
- There is genuine, implementation-blocking ambiguity where guessing would likely produce the wrong result, OR
- An action is irreversible/destructive or affects shared state beyond this repo (e.g. force-push, history rewrite, deleting remote data) and needs confirmation.

Routine work (picking features, creating tasks, spawning agents, committing to main, pushing, doc updates, memory writes) proceeds WITHOUT asking. Keep going until the user explicitly tells you to stop.

## Quick reference

- **Stack**: Three.js 0.160, TypeScript 5.4 (strict), Bun runtime, Vite 5 dev/build
- **Entry**: `src/main.ts` → `App` (state machine) → `GameSession` (one playthrough)
- **Validation gate**: `bun run typecheck && bun run build` — both must pass before any commit
- **Dev server**: `bun run dev` (defaults to http://localhost:5173)
- **Repo**: https://github.com/kream0/blockraft

---

## Project layout

```
src/
  App.ts                  # Top-level state machine: main_menu | worlds | create_world | in_game | paused | settings
  main.ts                 # Boots App. Two lines.
  types.ts                # FROZEN contract module — all interfaces, constants, message types live here
  game/
    GameSession.ts        # One playthrough. Created by App on world load; destroyed on quit-to-menu.
  world/
    World.ts              # IWorld impl. Owns chunks, EntityManager, raycast, render distance, override map.
    Chunk.ts              # 16x96x16 Uint8Array of BlockId. Carries solid + water meshes.
    ChunkMesher.ts        # Face-culled BufferGeometry builder. Splits solid + water into separate meshes.
    TerrainGenerator.ts   # Perlin FBM heightmap + tree placement. Deterministic from seed.
    BlockRegistry.ts      # Per-block metadata: textures, transparency, solidity.
  player/
    Player.ts             # Player state, camera, hotbar.
    Controls.ts           # Pointer-lock + WASD + mouse look. Configurable sensitivity + invertY.
    Physics.ts            # Fixed-step swept AABB collision (Y → X → Z order).
  entities/
    Entity.ts             # Abstract base: position, velocity, yaw, object3D, update, dispose.
    EntityManager.ts      # Spawn/despawn/tick. Owned by World. Snapshot iteration.
    Mob.ts                # Adds gravity + AABB physics. Override think() for AI.
    Zombie.ts             # Example mob. Wanders deterministically.
    RemotePlayer.ts       # Visual-only stub for future multiplayer peers.
  network/
    LocalAdapter.ts       # No-op INetworkAdapter. Foundation for a future WebSocketAdapter.
    index.ts              # Barrel.
  persistence/
    Settings.ts           # LocalStorage. validateSettings clamps every numeric on load AND save.
    WorldStorage.ts       # IndexedDB. Two object stores: world_meta, world_overrides. Promise-wrapped.
  ui/
    HUD.ts                # FPS, position, crosshair, click-to-play hint.
    Hotbar.ts             # 9-slot hotbar with selection.
    menu/
      MenuScreen.ts       # Abstract base. Subclasses call this.build() at the END of their own ctor.
      MainMenu.ts         # Singleplayer / Multiplayer (toast) / Settings / Quit.
      WorldsMenu.ts       # World list + Load/Delete + Create New + Back.
      CreateWorldMenu.ts  # Name (required, unique), optional seed, game mode.
      PauseMenu.ts        # Resume / Settings / Save and Quit to Menu.
      SettingsMenu.ts     # 6 sliders + 2 checkboxes. Live onChange.
      styles.ts           # Idempotent <style> injection (mc-* CSS classes).
  rendering/
    Renderer.ts           # WebGLRenderer + Scene + lights + fog. Configurable fog far.
    Materials.ts          # createChunkMaterial (opaque), createWaterMaterial (translucent).
    TextureAtlas.ts       # 4x4 grid of 16x16 procedural tiles (Canvas2D, deterministic LCG).
  utils/
    Hash.ts               # FNV-1a + xorshift mix. deriveSeed(name, userSeed?) for per-world seeds.
    MathUtils.ts          # floorDiv, mod, clamp.
    Noise.ts              # Classic Perlin 2D + FBM. Seeded via permutation table.
  interaction/
    BlockInteraction.ts   # Break/place via DDA raycast + player AABB overlap check.
```

---

## Architecture rules

1. **`src/types.ts` is the central contract.** All cross-module interfaces, constants, and message types live here. Modify carefully — everything depends on it.
2. **No circular dependencies.** World depends on entities (via tick), entities depend on `IWorld` (interface from types.ts). The interface boundary breaks the cycle.
3. **Disposal is mandatory.** Anything holding Three.js GPU resources (geometry, material, texture) must implement `dispose()`. Lifecycle: `App.start() → WorldStorage.open() → menus → load → GameSession.start() → ... → GameSession.stop() (which calls World.dispose() which calls EntityManager.clear())`.
4. **Fixed-step physics.** Player AND mob updates run at FIXED_DT (1/60s) inside GameSession's accumulator loop. Frame-driven systems (rendering, HUD, chunk streaming, mouse look) run at frame rate. Never tick mobs from `World.update` — that runs at frame rate and would tunnel.
5. **Pointer lock requires a user gesture.** Only acquire it inside a synchronous click/keypress handler (Resume button, Load button, Create button). Don't `await` before calling `requestPointerLock()`.
6. **Persistence boundaries.** World data → IndexedDB (`mc-clone` DB). Settings → LocalStorage. Settings writes are debounced 200ms; live-apply is immediate.
7. **Per-world seed.** `deriveSeed(name, userSeed?)` — same name always → same seed. Integer-string user seeds parse; non-numeric strings hash and mix.

---

## Best practices we follow

- **TypeScript strict everywhere**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`. Don't pass `undefined` to optional fields — omit the key instead.
- **No premature abstraction.** Three similar lines is better than a generic helper. Don't design for hypothetical futures.
- **No defensive code for impossible cases.** Trust internal invariants; validate only at boundaries (user input, IndexedDB, network).
- **Comments explain WHY, not WHAT.** If well-named identifiers convey the what, no comment is needed. Only non-obvious constraints, workarounds, or invariants get a comment.
- **Validate user-tunable values on every read AND write.** `validateSettings` clamps numerics to `SETTINGS_RANGES`; falls back to defaults for invalid booleans.
- **No `alert()`** — use the in-app toast (`App._toast`).
- **No backwards-compat shims.** Delete dead code; don't leave `// removed for X` comments.

---

## Agent team workflow (USE THIS FOR ANY NON-TRIVIAL FEATURE)

This codebase was built using a strict multi-agent pattern. Reuse it for any feature that touches more than one module.

### Phase order

1. **Contract phase** — _sequential, 1 implementer agent_
   Updates `src/types.ts` with new interfaces, constants, and message types needed by all downstream agents. This is the bottleneck; nothing else can start until it's done.

2. **Implementation phase** — _parallel, N implementer agents_
   Each agent owns a disjoint set of NEW files. They must NOT modify any file outside their ownership list. Send all Agent tool calls in a SINGLE message to run them concurrently.

3. **Integration phase** — _sequential, 1 implementer agent_
   Wires everything together: refactors entry points, modifies cross-cutting files (`App.ts`, `GameSession.ts`, `World.ts`), adapts existing modules to use the new types.

4. **Review phase** — _sequential, 1 reviewer agent (READ-ONLY)_
   Audits all changes. Reports HIGH/MED/LOW findings with `file:line` and concrete suggested fixes. Never edits.

5. **Fix phase** — _sequential, 1 implementer agent_
   Applies reviewer findings, runs full validation, reports any new issues found.

6. **Smoke test** — _the lead, directly_
   Use the `claude-in-chrome` MCP tools to click through the new feature in a real browser. Verify the golden path AND the failure paths the reviewer flagged.

### File ownership rules (PREVENT CONFLICTS)

- **Lead lists exact files each agent owns** in the agent's prompt — absolute paths.
- **An agent that needs a file outside its ownership must STOP and report** rather than silently editing it.
- **Reviewer is READ-ONLY.** Never edits.
- **Two agents NEVER edit the same file in parallel** — that causes overwrites.
- **Integration agent owns all cross-cutting files.** It runs after parallel agents have landed.

### Agent prompt template

Every agent prompt must include:

1. **What you're trying to accomplish + why** (the user-facing goal — give context, not just an instruction)
2. **Files you own (exclusive write)** — absolute paths, marked NEW or MODIFY or DELETE
3. **Files to read first** — the contracts and patterns to learn before editing (point to specific files; don't make the agent explore)
4. **Detailed spec** — function and class signatures, behavior, edge cases. Don't make the agent invent the API.
5. **Strict TS reminders** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any`.
6. **Validation step** — `bun run typecheck` (and `bun run build` for integration agents). Report stdout/stderr.
7. **Report format** — files created/modified/deleted, public exports, deviations from spec, validation result, anything you noticed but didn't fix.

### Parallelization

- Send multiple `Agent` tool calls in **one message** to run them concurrently.
- Only parallelize when file ownership is disjoint AND there are no inter-agent runtime dependencies.
- Use `TaskCreate` + `TaskUpdate` to track phases. Use `addBlockedBy` to encode dependencies (parallel agents depend on contract; integration depends on parallel; review depends on integration; fix depends on review).
- The `Explore` agent is for read-only research; never use it to edit.

### Context window discipline

- Each subagent has a finite context window. Don't make them re-explore the codebase.
- Provide the file paths and the patterns to follow directly in the prompt.
- Implementer focuses on its assigned files. Reviewer reads only the changed files plus immediate dependencies — don't audit the whole codebase.

---

## Validation gate

Before marking any task done:

1. `bun run typecheck` — zero errors
2. `bun run build` — completes; bundle reasonable (current baseline ≈ 519 KB; warn at 700 KB)
3. For UI/feature changes: smoke test in browser via `claude-in-chrome` MCP. Click the golden path, verify visuals match expectations.
4. Type checking and tests verify code correctness, not feature correctness — if you can't test the UI, say so explicitly rather than claiming success.

---

## Known gotchas (read this before debugging)

- **Pointer lock requires user gesture.** `requestPointerLock()` only works inside a synchronous click/keypress handler. Don't `await` before calling it. The Resume / Load / Create-World buttons all qualify because the click is the gesture.
- **IndexedDB unavailable in some private modes.** Firefox private windows can throw on `indexedDB.open`. `App.start()` catches and toasts; subsequent ops degrade gracefully (each call is wrapped).
- **Fresh-world signal.** `metadata.lastPlayed === metadata.createdAt` means "never played" → GameSession runs `findDrySpawn` instead of using the saved position. Both are set to the same `Date.now()` at world creation.
- **Chunk override format.** `Record<string, [linearIndex, BlockId][]>` keyed by `${cx},${cz}`. Last-write-wins per index. No size cap today — fine for v1.
- **Mob tunneling.** Mobs use a simple swept AABB at `FIXED_DT`. `mob speed × FIXED_DT` must stay below `radius` (0.3) to avoid wall tunneling. Today's Zombie at 1.5 b/s is safe (0.025 / tick).
- **`useDefineForClassFields: true` ordering.** Subclass field initializers run AFTER the super constructor. `MenuScreen` does NOT call `build()` — each subclass calls it at the END of its own constructor, after fields are set.
- **CRLF on Windows.** Git auto-converts on commit; the warnings are informational. Don't fight it.
- **`RENDER_DISTANCE` constant in types.ts** is still imported as a default by `Renderer.ts` and `World.ts` constructor — both are immediately overridden by `GameSession` with `settings.renderDistance`. Don't remove the const.
- **`EntityManager.spawn` writes `entity.id`.** `IEntity.id` is documented mutable-by-convention. Only EntityManager should ever assign it.
- **Settings are live-applied immediately, persisted debounced (200ms).** Don't lower the debounce to 0 — slider drags fire ~50 events/s and would thrash localStorage.
- **Multiplayer button is enabled** but `App.onMultiplayer` just shows a toast. A real impl needs a `WebSocketAdapter implements INetworkAdapter` plus server. The protocol message types are already in `types.ts`.

---

## Git conventions for this repo

> **This repo OVERRIDES the global `~/.claude/CLAUDE.md` branch/PR workflow.** This is a personal sandbox: **work directly on `main`.** Do NOT create `feature/`, `task/`, or `bugfix/` branches. Do NOT open pull requests. Commit straight to `main` and `git push` to `origin/main`. (The ADO ticket-to-PR flow in the global rules does not apply here.)

- Default branch: `main` — commit and push directly to it; never branch, never PR.
- Commit messages: short subject + bullet/paragraph body; end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` when AI was involved.
- Don't `--amend` published commits. Don't `--no-verify` to skip hooks.
- `node_modules/`, `dist/`, `.vite/`, `.env*`, `bun.lockb` are gitignored. `bun.lock` (text format) IS committed. Don't stage `.memorai/` (local memory store).
