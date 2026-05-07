export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Euclidean modulo: works correctly for negative dividends. */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export const floorDiv = (n: number, m: number): number => Math.floor(n / m);
