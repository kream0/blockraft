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
  `renderDistance` (fog far + chunk streaming), sensitivity, volumes, FPS toggle.
- **Structural composer rebuild** — disposes and recreates the `EffectComposer`:
  changing `antiAlias` (off/fxaa/smaa) or toggling `bloom`. Cheap (a few GPU allocations),
  but not per-frame; only on a settings change.
- **Material recompile** — sets `chunkMaterial.needsUpdate` / `waterMaterial.needsUpdate`
  so the unlit chunk/water shaders re-link. Triggered by `applyGraphics` returning
  `shadowRecompileNeeded`: when `shadowMapSize` toggles shadows **on↔off**, or when
  `shadowSoftness` changes **while shadows are on**.
- **Remesh all chunks** _(P2)_ — `atlasTileSize` / UV-gutter changes will rebuild every
  loaded chunk's geometry. Not yet wired.
- **Material recreate** _(P3)_ — `normalMaps` / `edgeRounding=normalmap` will swap the
  unlit chunk material for a `MeshStandardMaterial`. Not yet wired.

### shadowSoftness — the one runtime-recompile knob

`shadowSoftness` is the only graphics setting that can force a shader recompile, because the
unlit chunk material bakes the PCF filter type into a GLSL `#define` (`SHADOWMAP_TYPE_*`).
The recompile is gated on shadows being enabled: flipping softness with `shadowMapSize === 0`
is inert (the define isn't present), so we skip the `needsUpdate` to avoid a pointless stutter.

## SSAO is deferred to P5

The SSAO checkbox + samples slider exist and persist, but **SSAO is not wired into the P1
pipeline**. `three`'s `SSAOPass` renders a depth/normal prepass and a beauty pass that are
incompatible with our custom **unlit** chunk/water materials (baked linear vertex colors via
`onBeforeCompile`) — enabling it blacks out the scene. The presets therefore ship `ssao:false`
across the board. P5 (#391) implements ambient occlusion correctly for these materials.

## Adding a new block

Today: register the block in `BlockRegistry` with its atlas tile coordinates; `TextureAtlas`
draws the procedural tile. Roughness/normal surface detail is **not** part of the block
definition yet.

_(P3)_ will add optional `roughness` / `normalScale` fields to the block definition plus
normal + roughness atlas tiles, consumed by the `MeshStandardMaterial` chunk shader. Document
the exact fields here when that phase lands.
