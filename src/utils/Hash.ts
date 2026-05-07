/**
 * Pure deterministic string hashing for deriving world seeds.
 * No randomness, no globals — same input always produces the same u32.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit hash. Stable, fast, good avalanche. */
export function fnv1a(str: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i) & 0xffff;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Mix two u32 hashes deterministically (xorshift mix). */
export function mixHash(a: number, b: number): number {
  let x = (a ^ Math.imul(b | 0, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/**
 * Derive a u32 world seed from a world name and an optional user-typed seed.
 * If `userSeed` is a non-empty string that parses as an integer, mix that
 * directly with the name hash. Otherwise hash the userSeed string itself
 * and mix it. Always returns a u32 (>>> 0).
 */
export function deriveSeed(worldName: string, userSeed?: string): number {
  const nameHash = fnv1a(worldName);
  if (userSeed === undefined || userSeed === '') {
    return nameHash >>> 0;
  }
  const trimmed = userSeed.trim();
  if (trimmed === '') {
    return nameHash >>> 0;
  }
  // Match an optional sign followed by one or more digits — any other content
  // (e.g. "12abc", "1.5", "1e3") falls through to string hashing.
  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return mixHash(nameHash, parsed >>> 0);
    }
  }
  return mixHash(nameHash, fnv1a(userSeed));
}
