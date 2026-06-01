import * as THREE from 'three';

/**
 * Screen-space radial light-scatter post-processing shader (McGuire / GPU Gems 3 ch.13 style).
 *
 * The renderer is responsible for:
 *   - Setting `uSunPos` to the sun's projected UV each frame (project world-space sun position
 *     through the camera, remap from NDC [-1,1] to UV [0,1]).
 *   - Setting `uIntensity` to `godraysStrength × visibility` each frame, where visibility
 *     is 0 when the sun is below the horizon or off-screen (clamped, not abrupt cutoff).
 *     When `uIntensity` is 0 the shader is an exact passthrough — no cost, no visual change.
 *
 * The luminance mask inside the fragment loop is the key physics approximation: only pixels
 * whose luminance exceeds MASK_LOW are treated as emitters; darker pixels (terrain, shadow,
 * water) contribute nothing and act as occluders. This is what creates the volumetric fan
 * pattern around terrain silhouettes without a dedicated occlusion pass.
 *
 * The tuning constants (DENSITY, WEIGHT, DECAY, EXPOSURE) are calibrated for the linear-HDR
 * composer buffer — this pass must run before OutputPass / tone-mapping. Adjusting them in
 * isolation changes the ray length (DENSITY × SAMPLES), per-sample brightness (WEIGHT),
 * fall-off rate (DECAY), and overall gain (EXPOSURE × uIntensity).
 */

/** Typed uniform map for the god-rays shader. */
export interface GodraysShaderDef {
  uniforms: {
    /** ShaderPass writes the read buffer here before each render. */
    tDiffuse: { value: THREE.Texture | null };
    /** Sun position in screen UV space (0..1 on both axes). Updated per-frame by the renderer. */
    uSunPos: { value: THREE.Vector2 };
    /** Overall ray strength × on-screen visibility. 0 makes the shader a passthrough. */
    uIntensity: { value: number };
    /** Warm tint blended onto the ray accumulation, mimicking sunlight colour temperature. */
    uColor: { value: THREE.Color };
  };
  vertexShader: string;
  fragmentShader: string;
}

const _vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`.trim();

const _fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2      uSunPos;
uniform float     uIntensity;
uniform vec3      uColor;

#define SAMPLES 60
const float DENSITY   = 0.92;
const float WEIGHT    = 0.045;
const float DECAY     = 0.96;
const float EXPOSURE  = 1.0;
const float MASK_LOW  = 0.60;   // luminance (linear HDR) below which a sample is treated as occluder
const float MASK_HIGH = 1.00;   // luminance at/above which a sample scatters fully

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec4 original = texture2D(tDiffuse, vUv);
  // uIntensity below a tiny epsilon means no perceptible ray contribution; treat as disabled (passthrough).
  if (uIntensity < 0.001) { gl_FragColor = original; return; }

  vec2 texCoord = vUv;
  vec2 deltaTexCoord = (vUv - uSunPos) * (DENSITY / float(SAMPLES));
  float illumDecay = 1.0;
  vec3 accum = vec3(0.0);

  for (int i = 0; i < SAMPLES; i++) {
    texCoord -= deltaTexCoord;
    vec3 s = texture2D(tDiffuse, texCoord).rgb;
    // Only bright sky/sun pixels scatter; darker terrain acts as an occluder, so rays
    // fan out around terrain silhouettes (cheap screen-space approximation, no occlusion pass).
    float mask = smoothstep(MASK_LOW, MASK_HIGH, luma(s));
    accum += s * mask * illumDecay * WEIGHT;
    illumDecay *= DECAY;
  }

  vec3 rays = accum * EXPOSURE * uColor * uIntensity;
  gl_FragColor = vec4(original.rgb + rays, original.a);
}
`.trim();

/**
 * Returns a fresh shader definition object suitable for `new ShaderPass(makeGodraysShader())`.
 * Each call allocates new uniform value objects so two passes never share mutable state.
 */
export function makeGodraysShader(): GodraysShaderDef {
  return {
    uniforms: {
      tDiffuse:   { value: null },
      uSunPos:    { value: new THREE.Vector2(0.5, 0.5) },
      uIntensity: { value: 0.0 },
      uColor:     { value: new THREE.Color(1.0, 0.93, 0.78) },
    },
    vertexShader:   _vertexShader,
    fragmentShader: _fragmentShader,
  };
}
