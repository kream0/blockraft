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
| cloudDetail      | low     | medium   | high      | ultra       | P5    |

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
- **Live uniform flip _or_ water-only material swap** _(P4)_ — changing `waterQuality` between
  `basic` and `animated` just flips the `uWaterAnim` uniform live (`setWaterAnimated`; no
  recompile, no remesh). Crossing the **reflective** boundary toggles the `WATER_REFLECTIVE`
  `#define`, so the water material is recreated and reassigned to every loaded water mesh via
  `World.setWaterMaterial` (no remesh — water geometry is unchanged). See "Water realism" below.

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

## Water realism (P4)

Water keeps the same `onBeforeCompile`-patched `MeshStandardMaterial` as terrain — `patchChunkLighting`
runs on it too, so water inherits the baked, leak-free voxel light, the day/night sky fade, and the
directional-sun specular. P4 layers three water-only effects on top, all inside the same patch:

- **Scrolling ripple** — when `uWaterAnim > 0.5`, a two-octave sine field driven by the `uWaterTime`
  uniform (seconds) perturbs the surface **normal**. It is gated to **up-facing** water only: the patch
  reconstructs the geometric world normal from `dFdx`/`dFdy(vWaterWorldPos)` and applies the ripple where
  `abs(geomWorldN.y) > 0.5`, so vertical water faces stay flat. The world-space gradient is rotated into
  view space with `mat3(viewMatrix)` (the fragment prefix has no `normalMatrix`) and added to `normal`
  before lighting, so the sun glint shifts as the surface tilts.
- **Fresnel opacity** — a Schlick term `pow(1 - dot(N, V), 5)` (with `V = normalize(vViewPosition)`) raises
  `gl_FragColor.a` toward opaque at grazing angles, right after `#include <opaque_fragment>`. Also gated on
  `uWaterAnim`, so the cheapest tier keeps flat 0.7 alpha.
- **Reflective sky tint** — the `WATER_REFLECTIVE` `#define` variant mixes a fixed sky color, scaled by the
  `uDayNight` uniform (so it darkens at night), into the fragment rgb and nudges alpha up. Compiled only
  when the define is set.

**Quality tiers** (`waterQuality`; presets Low/Medium = `basic`, High = `animated`, Ultra = `reflective`):

| Tier         | Ripple | Fresnel | Sky tint | `uWaterAnim` | `WATER_REFLECTIVE` |
|--------------|--------|---------|----------|--------------|--------------------|
| `basic`      | —      | —       | —        | 0            | off                |
| `animated`   | yes    | yes     | —        | 1            | off                |
| `reflective` | yes    | yes     | yes      | 1            | on                 |

`basic` is **intentionally plain** — flat translucency identical to the pre-P4 baseline, no Fresnel — so the
cheapest tier costs nothing extra. (Fresnel/glint are part of the *animated* upgrade, not a view-dependent
default applied to every tier.)

**Wiring & cost.** Every tier compiles the **same** water GLSL (the ripple/Fresnel blocks are present but
runtime-gated by `uWaterAnim`), so switching `basic`↔`animated` is a **live uniform flip**:
`setWaterAnimated(waterMaterial, on)` toggles the `uWaterAnim` holder, no recompile, no remesh. Crossing the
**reflective** boundary toggles a `#define`, which GLSL bakes at compile time, so the water material is
**recreated** and reassigned to every loaded water mesh via `World.setWaterMaterial` (water geometry is
unchanged — no remesh). `GameSession` advances `_waterTime` and calls `setWaterTime` **only** for non-`basic`
tiers, so a `basic` world does zero per-frame ripple work. The `uWaterTime` / `uWaterAnim` uniforms are
stashed in `material.userData` (keys `blockraftWaterTime` / `blockraftWaterAnim`) so the two setters can
reach them without re-walking the shader.

## Atmosphere — gradient sky dome (P5)

`SkyDome` (`src/rendering/SkyDome.ts`) is the first P5 atmosphere increment: a camera-following
gradient skybox that replaces the flat single-colour sky. It mirrors the self-contained renderer
pattern of `SkyBodies` / `Clouds` (`readonly object3D`, `update(state, camPos)`, `dispose()`) and
`GameSession` creates / `scene.add`s / updates / disposes it alongside the sun & moon. It is
**always-on** — not a graphics knob, no preset row, one extra draw call.

**Geometry & draw order.** An inward-facing `SphereGeometry` (radius `SKY_DOME_RADIUS` = 500, < the
1000 camera far) with `side: BackSide`. The mesh is recentred on the camera every frame
(`object3D.position.copy(camPos)`), `frustumCulled = false`, and drawn as a skybox: `depthTest:false`,
`depthWrite:false`, `renderOrder:-1000`. So it paints first (behind everything) and writes no depth —
terrain (renderOrder 0) and the sun/moon billboards (`SkyBodies`, renderOrder -10) draw over it, and
the flat clear colour is fully overdrawn wherever the dome covers (which is everywhere).

**Shader.** A raw `ShaderMaterial` with `fog:false`. The fragment derives a vertical gradient from the
normalized view direction's `y` (`smoothstep`-eased): **horizon = `state.skyColor`** (so it blends
seamlessly with the flat clear colour + screen-space fog, which are the same colour) and **zenith =
`skyColor × ZENITH_DARKEN` (0.55)** for atmospheric depth. A warm halo is added from the **toward-sun**
direction (`-state.sunDirection`, since `sunDirection` is the direction light *travels*) as
`pow(dot,8)·0.5 + pow(dot,220)·1.3`, tinted by `state.sunColor` and scaled by `state.daylight` so it
fades to nothing at night. The whole gradient auto-scales across the day/night cycle because every
input is the live `SkyState` (copied out each frame — never retained, since `SkyState` is reused).

**Colour space (why no horizon seam).** The dome feeds `THREE.Color` values (`skyColor`, `sunColor`)
straight into `vec3` uniforms and does linear math. That is consistent with the rest of the scene
because `THREE.ColorManagement` is enabled (r0.160 default) and the `DayNightCycle` palette is built
from hex `new THREE.Color(...)`, so the stored `.r/.g/.b` are already in the **linear** working space —
the *same* values `renderer.setClearColor`, `scene.fog.color`, and `scene.background` consume. The P1
`OutputPass` applies tone mapping + sRGB encode **once** at the end of the composer for the entire
buffer (the dome included), so the raw-shader output never diverges from the fog it abuts. (Manually
`pow(2.2)`-linearizing the uniforms would *double-convert* and *create* the seam.) The bright sun halo
exceeds 1.0 and **blooms for free** through the existing `UnrealBloomPass` — no pipeline change.

## Cloud detail (P5)

`cloudDetail` (low / medium / high / ultra) drives the resolution and density of the procedural
cloud sheet that `Clouds` (`src/rendering/Clouds.ts`) bakes into a tileable `CanvasTexture`. The
level maps to a `{ textureSize, blobCount }` pair via `CLOUD_DETAIL_PARAMS` — **128 px / 8 blobs**
at Low up to **512 px / 48 blobs** at Ultra — so higher tiers paint a crisper, denser cloud field.
Blob radius scales with `textureSize` (`scale = SIZE / 256`), so the clouds keep the same apparent
size at every resolution; only the crispness and blob count change. The 3×3 wrapped-copy blob draw
keeps the texture seamlessly tileable at any size.

**Cost to change.** `Clouds.setDetail()` rebuilds just the procedural texture (a Canvas2D draw — no
geometry change and **no chunk remesh**), swaps it onto the existing `MeshBasicMaterial.map`, and
disposes the old one; it's a no-op when the level is unchanged. `GameSession` constructs `Clouds` at
the saved detail and diffs `cloudDetail` in `applySettings`, live-applying via `setDetail`
(side-effecting call first, then update `_lastCloudDetail` — matching the water-quality block's
order). Switching detail is therefore cheap and instant; the only allocation is the replacement
canvas + texture (the old one is disposed the same frame).

## Emissive block bloom (P5)

`emissiveBloom` (off at Low/Medium, on at High/Ultra) makes torches, glowstone and lava visibly
**glow** at night by feeding the existing HDR bloom pass. It needs no new geometry, no new vertex
attribute, and no remesh — it reuses the per-vertex light split the mesher already bakes.

**How the channel split makes this free.** The mesher packs sky light and block (torch/glowstone/
lava) light into *separate* vertex-color channels: `color.r = faceShade·AO·skyBrightness` and
`color.g = faceShade·AO·blockBrightness`. The chunk shader's baked-light branch (injected by
`patchChunkLighting` in `Materials.ts`, inside the `#ifdef USE_COLOR` block) already recovers
`skyLit` and `blockLit` from those channels. Emissive bloom adds one term there:

```glsl
float emissiveAmt = smoothstep(0.55, 1.0, blockLit);
totalEmissiveRadiance += diffuseColor.rgb * warmTint * emissiveAmt * uEmissiveBloom;
```

`smoothstep(0.55, 1.0, blockLit)` gates the glow to only strongly *block-lit* faces, so ordinary
sky-lit daytime terrain never glows — a torch face (blockLit ≈ 1.0) ramps in, a grass field
(blockLit ≈ 0) stays at zero. `warmTint` reuses the same firelight-orange tint the diffuse path
uses. The result lands in `totalEmissiveRadiance`, which MeshStandard adds *after* tone-mapping
clamps the lit diffuse — so when `uEmissiveBloom = 1.8` the face exceeds 1.0 in the HDR target and
`UnrealBloomPass` (already in the P1 pipeline) blooms it. With bloom off the extra radiance is
simply a slightly brighter emitter.

**Cost to change.** `uEmissiveBloom` is a live uniform (`0.0` off, `EMISSIVE_BLOOM_STRENGTH = 1.8`
on) held in `material.userData` and wired in `onBeforeCompile`. `setChunkEmissiveBloom()` flips it
with **no shader recompile**; `GameSession.applySettings` diffs `emissiveBloom` and calls it
(side-effecting call first, then update `_lastEmissiveBloom` — matching the cloud/water blocks).
The term is injected unconditionally, so toggling is a pure uniform write; when off the term is
multiplied by `0.0` and is exactly a no-op. Only the solid chunk material carries the uniform —
`createWaterMaterial` never enables it, so water never glows.

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
