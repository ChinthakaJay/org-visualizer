/**
 * Team colours. Each top-level Team takes a hue from a fixed palette by a stable hash of its id, so
 * adding or removing other Teams never changes it. Sub-teams take shades of that hue by depth, and
 * `color=` overrides the hue for a Team and everything below it. The renderer turns these into
 * light- or dark-theme fills.
 */
export interface TeamColour {
  /** 0–360. */
  hue: number;
  /** 0–100; 0 is neutral grey. */
  saturation: number;
  /** The Team's depth: 0 for a top-level Team, deeper Teams get stronger shades. */
  shade: number;
}

export type Hue = Pick<TeamColour, 'hue' | 'saturation'>;

const PALETTE: number[] = [212, 152, 28, 276, 352, 186, 46, 318, 96, 244, 8, 128];
const PALETTE_SATURATION = 62;

const NAMED: Record<string, Hue> = {
  red: { hue: 0, saturation: 70 },
  orange: { hue: 28, saturation: 80 },
  amber: { hue: 42, saturation: 85 },
  yellow: { hue: 52, saturation: 85 },
  lime: { hue: 90, saturation: 60 },
  green: { hue: 140, saturation: 55 },
  teal: { hue: 174, saturation: 60 },
  cyan: { hue: 190, saturation: 70 },
  blue: { hue: 214, saturation: 70 },
  indigo: { hue: 234, saturation: 60 },
  violet: { hue: 262, saturation: 60 },
  purple: { hue: 280, saturation: 55 },
  magenta: { hue: 300, saturation: 60 },
  pink: { hue: 330, saturation: 70 },
  brown: { hue: 25, saturation: 40 },
  grey: { hue: 0, saturation: 0 },
  gray: { hue: 0, saturation: 0 },
};

/** The palette hue for a top-level Team, from a stable FNV-1a hash of its id. */
export function paletteHue(id: string): Hue {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return { hue: PALETTE[(hash >>> 0) % PALETTE.length], saturation: PALETTE_SATURATION };
}

/** Function badge colours, ordered so the first few in use are as far apart as possible. */
const FUNCTION_PALETTE: Hue[] = [
  { hue: 214, saturation: 70 }, // blue
  { hue: 28, saturation: 80 }, // orange
  { hue: 140, saturation: 55 }, // green
  { hue: 318, saturation: 60 }, // magenta
  { hue: 46, saturation: 85 }, // yellow
  { hue: 270, saturation: 55 }, // purple
  { hue: 190, saturation: 70 }, // cyan
  { hue: 356, saturation: 70 }, // red
  { hue: 90, saturation: 60 }, // lime
  { hue: 236, saturation: 60 }, // indigo
  { hue: 168, saturation: 60 }, // teal
  { hue: 334, saturation: 70 }, // pink
];

/** How Functions are compared: ignoring case and outer spaces. */
export const functionKey = (fn: string) => fn.trim().toLowerCase();

/**
 * Badge colours for the Functions in use. The distinct Functions are sorted by name and handed
 * palette colours in turn, so up to twelve always look different. Adding a Function can shift the
 * colours of those that sort after it; the order of lines never matters.
 */
export function functionColours(fns: Iterable<string>): Map<string, Hue> {
  const keys = [...new Set([...fns].map(functionKey))].filter(Boolean).sort();
  return new Map(keys.map((key, i) => [key, FUNCTION_PALETTE[i % FUNCTION_PALETTE.length]]));
}

/** Reads a `color=` value: a name from the list above, or #rgb / #rrggbb. Null if it isn't one. */
export function parseColour(value: string): Hue | null {
  const v = value.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { hue: 0, saturation: 0 };
  const l = (max + min) / 2;
  const saturation = d / (1 - Math.abs(2 * l - 1));
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: Math.round((hue * 60 + 360) % 360), saturation: Math.round(saturation * 100) };
}

export const COLOUR_NAMES = Object.keys(NAMED).filter((n) => n !== 'gray');
