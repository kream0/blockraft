# Graphics pipeline & quality settings

How the graphics knobs in **Settings → Graphics** map to the renderer, and what each one
costs to change at runtime. This doc grows as the visual-overhaul phases land — sections
marked _(Pn)_ are scaffolded in the UI but not yet wired to a visual effect.

## Quality presets

Picking a preset writes every field below into `Settings`; switching any individual field
afterwards flips the quality label to **Custom**. Source of truth: `GRAPHICS_PRESETS` in
`src/types.ts`.

| Setting          | Low     | Medium   | High      | Ultra       | Wired |
|------------------|---------|----------|-----------|-------------|-------|
| pixelRatioCap    | 1.0     | 1.5      | 2.0       | 3.0         | P1    |
| antiAlias        | off     | fxaa     | smaa      | smaa        | P1    |
| toneMapping      | none    | linear   | aces      | aces        | P1    |
| fogType          | linear  | linear   | exp2      | exp2        | P1    |
| shadowMapSize    | 0 (off) | 512      | 1024      | 2048        | P1    |
| shadowSoftness   | pcf     | pcf      | pcfsoft   | pcfsoft     | P1    |
| bloom            | off     | off      | on        | on          | P1    |
| bloomIntensity   | 0.0     | 0.0      | 0.4       | 0.6         | P1    |
| ssao / samples   | off / 8 | off / 8  | off / 8   | off / 16    | P5    |
| normalMaps       | off     | off      | on        | on          | P3    |
| edgeRounding     | off     | analytic | normalmap | normalmap   | P3    |
| atlasTileSize    | 16      | 16       | 32        | 64          | P2    |
| anisotropy       | 1       | 4        | 8         | max         | P2    |
| waterQuality     | basic   | basic    | animated  | reflective  | P4    |
| cloudDetail      | low     | medium   | high      | ultra       | P4    |

## Post-processing pipeline (P1)

`Renderer.rebuildComposer` assembles an `EffectComposer` with an HDR (`HalfFloatType`)
render target. Pass order is fixed:

```
RenderPass (scene)  →  UnrealBloomPass (if bloom)  →  FXAA | SMAA (if AA)  →  OutputPass
```

`OutputPass` is always last: it bakes tone mapping (`renderer.toneMapping`) and the sRGB
encode (`renderer.outputColorSpace`) in-shader, so the intermediate targets stay linear and
tone mapping is applied exactly once. When a preset needs **no** composer passes
(`antiAlias === off && !bloom`, i.e. Low) the composer is left null and `render()` calls
`renderer.render()` directly — zero post-processing overhead.

## What each change costs

`Renderer.applyGraphics(settings, camera)` diffs against the last-applied settings and does
the minimum work. Cost tiers, cheapest first:

- **Live, no rebuild** — applied in place every call: `pixelRatioCap`, `toneMapping`,
  `fogType` (swaps the `scene.fog` object between `Fog`/`FogExp2`), `bloomIntensity`,
  `bloomThreshold`. Also handled live in `GameSession.applySettings`: `fov`,
  `renderDistance` (fog far + chunk streaming), `anisotropy` (atlas texture re-upload,
  no remesh), sensitivity, volumes, FPS toggle.
- **Structural composer rebuild** — disposes and recreates the `EffectComposer`:
  changing `antiAlias` (off/fxaa/smaa) or toggling `bloom`. Cheap (a few GPU allocations),
  but not per-frame; only on a settings change.
- **Material recompile** — sets `chunkMaterial.needsUpdate` / `waterMaterial.needsUpdate`
  so the chunk/water shaders re-link. Triggered by `applyGraphics` returning
  `shadowRecompileNeeded`: when `shadowMapSize` toggles shadows **on↔off**, or when
  `shadowSoftness` changes **while shadows are on**.
- **Remesh all chunks** _(P2)_ — changing `atlasTileSize` rebuilds the atlas at the new
  tile resolution and remeshes every loaded chunk (the new UV gutters change the geometry's
  UVs). Driven by `GameSession.applySettings` → `World.rebuildForAtlas`; progress shows in a
  HUD banner. See "Tiered atlas resolution & anisotropy" below.
- **Material swap + conditional remesh** _(P3)_ — changing `normalMaps` or `edgeRounding`
  recompiles both the chunk and water materials and reassigns them to every loaded chunk. A
  full remesh runs **only when the tangent requirement flips** (tangents are needed for
  tangent-space normal mapping but not for the analytic bevel), e.g. Medium→High. See
  "Normal/roughness maps & the MeshStandard chunk material" below.

### shadowSoftness — the one runtime-recompile knob

`shadowSoftness` is the only graphics setting that can force a shader recompile, because the
chunk material bakes the PCF filter type into a GLSL `#define` (`SHADOWMAP_TYPE_*`).
The recompile is gated on shadows being enabled: flipping softness with `shadowMapSize === 0`
is inert (the define isn't present), so we skip the `needsUpdate` to avoid a pointless stutter.

## Tiered atlas resolution & anisotropy (P2)

`atlasTileSize` (16 / 32 / 64 px per tile) trades texture memory for surface crispness. The
`TextureAtlas` redraws its 4×4 procedural grid at the chosen resolution and surrounds every
tile with a **gutter** — a `gutterFor(tileSize)` border of `0 / 2 / 4` px at 16 / 32 / 64 —
whose edge texels are duplicated outward. The gutter stops neighbouring tiles bleeding into
each other once mipmapping and anisotropic filtering sample beyond a tile's nominal bounds;
at 16 px the gutter is 0, so the atlas is byte-for-byte the original.

Because UVs must land inside the gutter-inset tile, the mesh worker needs the same atlas
geometry the main thread used. `WorkerAtlasParams` carries `tilePixels`, `atlasCols`,
`atlasRows`, `atlasSize`, and `gutterPixels`; `TextureAtlas.getUV` and the worker's
`chunkMeshCore.getUV` run **identical** gutter-aware math that reduces to the original
formula when `gutterPixels === 0`.

**Runtime change path.** `GameSession.applySettings` detects an `atlasTileSize` change,
calls `atlas.rebuild(tileSize)`, reads the fresh `atlas.getAtlasParams()`, and hands them to
`World.rebuildForAtlas(params)`. That re-posts the worker init message
(`MeshQueue.updateAtlasParams`, so every future mesh job uses the new UV math) and
re-enqueues a remesh for each loaded chunk, returning the count. The HUD shows a
`Rebuilding terrain N/total…` banner that the frame loop updates from `World.meshPending()`
and auto-hides at completion.

**`anisotropy`** (1 / 4 / 8 / max, where `max` resolves to the GPU's
`capabilities.getMaxAnisotropy()`) is applied live by `atlas.setAnisotropy`: it sets the
texture's `anisotropy` and flags `needsUpdate`, a texture re-upload with **no** geometry
remesh.

## Normal/roughness maps & the MeshStandard chunk material (P3)

P3 replaces the unlit chunk/water materials with `onBeforeCompile`-patched
`MeshStandardMaterial`s, so terrain picks up PBR roughness, normal-mapped surface relief, and a
sun specular highlight — **without** losing the baked, leak-free voxel lighting. The patch
(`patchChunkLighting` in `Materials.ts`) keeps baked vertex light authoritative for diffuse:

- The mesher packs two light terms into the vertex `color`: **`r` = sky**
  (`faceShade · AO · skyLevel`) and **`g` = block/torch** (`faceShade · AO · blockLevel`).
  `faceShade` is a fixed per-face directional shade (top 1.0, bottom 0.5, N/S 0.8, E/W 0.6) so
  even flat ambient light keeps each face's 3D form.
- In the fragment shader the patch **zeroes `reflectedLight.directDiffuse`**, writes the baked
  term into **`indirectDiffuse`**, and **zeroes `indirectSpecular`** — but **keeps
  `directSpecular`**, so the sun adds a roughness-shaped glint on top of the baked diffuse.
- The `uDayNight` uniform fades the **sky** channel between a night floor (`NIGHT_SKY_FLOOR`
  = 0.15) and full daylight; the directional-light **shadow** term darkens only the sky channel
  and only in daylight (`SHADOW_MIN` = 0.35 · `uDayNight`), so torch-lit blocks and cave faces
  are never shadowed. `getShadowMask()` is injected right after `<shadowmap_pars_fragment>`
  because the `meshphysical` fragment preamble includes the shadow**map** chunk but not the
  shadow**mask** chunk that defines it.

**Two edge-relief modes** (the `edgeRounding` setting):

- `analytic` (Medium) — a `#define ANALYTIC_BEVEL` variant perturbs the surface normal near
  block edges from the fragment's **world-space** position (no texture, no tangents). The
  world-space perturbation is rotated into view space with `mat3(viewMatrix)` (the fragment
  prefix declares `viewMatrix` but not `normalMatrix`).
- `normalmap` (High/Ultra) — samples the companion tangent-space **normal atlas** (`normalScale`
  0.6); requires the per-vertex `tangent` attribute.

**Companion atlases.** `TextureAtlas` generates two textures alongside the albedo atlas, sharing
its tile grid and gutter. `paintNormal` bakes a uniform **chamfer bevel** into every tile — a
`tileSize/8` edge band smoothstep-tilts the tangent-space normal outward, interior stays flat
(RGB 128,128,255). `paintRoughness` writes greyscale roughness (read from `.g`) with a default
of **0.85** (matte) and glossy per-tile-index overrides. The chunk material binds these as
`normalMap` + `roughnessMap` with `roughness:1.0`, `metalness:0`, `envMapIntensity:0`.

**Tangents.** The `tangent` attribute (4 floats: xyz + handedness) is only needed for
tangent-space normal mapping, so `includeTangents = normalMaps || edgeRounding === 'normalmap'`
— Low/Medium skip the extra buffer. The worker emits it conditionally; the synchronous fallback
always emits it (an unused tangent attribute is harmless). Because it changes geometry, flipping
`includeTangents` is the one P3 setting change that forces a remesh.

## SSAO is deferred to P5

The SSAO checkbox + samples slider exist and persist, but **SSAO is not wired into the P1
pipeline**. `three`'s `SSAOPass` renders a depth/normal prepass and a beauty pass that are
incompatible with our chunk/water materials: P3 made them `MeshStandardMaterial`s, but the
`onBeforeCompile` patch still drives diffuse from baked vertex colors (it zeroes the lit
`directDiffuse` and writes the baked term into `indirectDiffuse`), so `SSAOPass`'s beauty pass
blacks out the scene. The presets therefore ship `ssao:false` across the board. P5 (#391)
implements ambient occlusion correctly for these materials.

## Adding a new block

Today: register the block in `BlockRegistry` with its atlas tile coordinates; `TextureAtlas`
draws the procedural tile. Roughness/normal surface detail is **not** part of the block
definition yet.

P3 added the `MeshStandardMaterial` chunk shader plus procedural **normal** and
**roughness/AO** atlases. Surface character is currently authored **per atlas tile**, not per
block: `TextureAtlas.paintNormal` bakes a uniform chamfer bevel into every tile's edge band, and
`TextureAtlas.paintRoughness` writes a default roughness of **0.85** (matte) with glossy
per-tile-index overrides. The contract also reserves optional `BlockDef.roughness` /
`BlockDef.normalStrength` fields for future per-block control; they are **not consumed yet** —
wire them through the atlas/mesher when a block needs to override the tile defaults.
