/**
 * Classic Ken Perlin 2D noise with a permutation table seeded via a small LCG.
 * Deterministic for the same seed.
 */
export class PerlinNoise {
  private readonly perm: Uint8Array;

  constructor(seed: number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // LCG (Numerical Recipes) for a deterministic shuffle.
    let state = (seed >>> 0) || 1;
    const rand = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };

    // Fisher-Yates
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const a = p[i] ?? 0;
      const b = p[j] ?? 0;
      p[i] = b;
      p[j] = a;
    }

    // Duplicate to length 512 to avoid index wrapping.
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255] ?? 0;
    }
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private static grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private static grad3(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /** 2D noise in approximately [-1, 1]. */
  noise2D(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = PerlinNoise.fade(xf);
    const v = PerlinNoise.fade(yf);

    const p = this.perm;
    const aa = (p[xi] ?? 0) + yi;
    const ab = (p[xi] ?? 0) + yi + 1;
    const ba = (p[xi + 1] ?? 0) + yi;
    const bb = (p[xi + 1] ?? 0) + yi + 1;

    const x1 = PerlinNoise.lerp(
      PerlinNoise.grad(p[aa] ?? 0, xf, yf),
      PerlinNoise.grad(p[ba] ?? 0, xf - 1, yf),
      u,
    );
    const x2 = PerlinNoise.lerp(
      PerlinNoise.grad(p[ab] ?? 0, xf, yf - 1),
      PerlinNoise.grad(p[bb] ?? 0, xf - 1, yf - 1),
      u,
    );

    return PerlinNoise.lerp(x1, x2, v);
  }

  /** 3D noise in approximately [-1, 1]. */
  noise3D(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = PerlinNoise.fade(xf);
    const v = PerlinNoise.fade(yf);
    const w = PerlinNoise.fade(zf);

    const p = this.perm;
    const a = (p[xi] ?? 0) + yi;
    const aa = (p[a] ?? 0) + zi;
    const ab = (p[a + 1] ?? 0) + zi;
    const b = (p[xi + 1] ?? 0) + yi;
    const ba = (p[b] ?? 0) + zi;
    const bb = (p[b + 1] ?? 0) + zi;

    const x1 = PerlinNoise.lerp(
      PerlinNoise.lerp(
        PerlinNoise.grad3(p[aa] ?? 0, xf, yf, zf),
        PerlinNoise.grad3(p[ba] ?? 0, xf - 1, yf, zf),
        u,
      ),
      PerlinNoise.lerp(
        PerlinNoise.grad3(p[ab] ?? 0, xf, yf - 1, zf),
        PerlinNoise.grad3(p[bb] ?? 0, xf - 1, yf - 1, zf),
        u,
      ),
      v,
    );
    const x2 = PerlinNoise.lerp(
      PerlinNoise.lerp(
        PerlinNoise.grad3(p[aa + 1] ?? 0, xf, yf, zf - 1),
        PerlinNoise.grad3(p[ba + 1] ?? 0, xf - 1, yf, zf - 1),
        u,
      ),
      PerlinNoise.lerp(
        PerlinNoise.grad3(p[ab + 1] ?? 0, xf, yf - 1, zf - 1),
        PerlinNoise.grad3(p[bb + 1] ?? 0, xf - 1, yf - 1, zf - 1),
        u,
      ),
      v,
    );
    return PerlinNoise.lerp(x1, x2, w);
  }

  /** Fractal/octave 3D noise; result approximately in [-1, 1]. */
  fbm3D(x: number, y: number, z: number, octaves: number, lacunarity = 2.0, persistence = 0.5): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return maxAmplitude === 0 ? 0 : total / maxAmplitude;
  }

  /** Fractal/octave noise; result is approximately in [-1, 1]. */
  fbm(x: number, y: number, octaves: number, lacunarity = 2.0, persistence = 0.5): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return maxAmplitude === 0 ? 0 : total / maxAmplitude;
  }
}
