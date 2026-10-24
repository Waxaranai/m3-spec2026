import {
  Hct,
  argbFromHex,
  hexFromArgb,
  MaterialDynamicColors,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  type DynamicColor,
  type DynamicScheme,
  type TonalPalette,
} from '@material/material-color-utilities';

import { ROLE_DEFS, ROLE_ORDER, type RoleGroup } from './roles';

export type Mode = 'light' | 'dark';
export type Platform = 'phone' | 'watch';
export type StyleKey =
  | 'tonal'
  | 'vibrant'
  | 'expressive'
  | 'neutral'
  | 'monochrome'
  | 'fidelity'
  | 'content'
  | 'rainbow'
  | 'fruit';

export type RoleSpec = '2021' | '2025';

export interface HctTriple {
  hue: number;
  chroma: number;
  tone: number;
}

export interface RoleColor {
  key: string;
  group: RoleGroup;
  argb: number;
  hex: string;
  hct: HctTriple;
}

export type RoleMap = Record<string, RoleColor>;

export interface TonalPaletteInfo {
  key: string;
  label: string;
  hue: number;
  chroma: number;
  tones: Array<{ tone: number; hex: string; argb: number }>;
}

export interface Scheme {
  /** The requested seed, before Android's low-chroma fallback. */
  seedHex: string;
  /** The seed actually used to resolve palettes. */
  effectiveSeedHex: string;
  seedHct: HctTriple;
  effectiveSeedHct: HctTriple;
  lowChromaFallback: boolean;
  style: StyleKey;
  styleLabel: string;
  styleDescription: string;
  variant: string;
  /** The role spec that Android resolves for this style when SPEC_2026 is requested. */
  roleSpec: RoleSpec;
  platform: Platform;
  contrast: number;
  light: RoleMap;
  dark: RoleMap;
  palettes: TonalPaletteInfo[];
  roleOrder: string[];
}

export interface SchemeOptions {
  seedArgb: number;
  style: StyleKey;
  contrast: number;
  platform: Platform;
}

type SchemeConstructor = new (
  sourceColorHct: Hct,
  isDark: boolean,
  contrastLevel: number,
  specVersion?: '2021' | '2025',
  platform?: Platform,
) => DynamicScheme;

export interface StyleDef {
  key: StyleKey;
  label: string;
  description: string;
  variant: string;
  roleSpec: RoleSpec;
  ctor: SchemeConstructor;
}

export const STYLE_DEFS: StyleDef[] = [
  {
    key: 'tonal',
    label: 'Tonal Spot',
    description: 'Calm and balanced. The Android default and the style in the reference gist.',
    variant: 'TONAL_SPOT',
    roleSpec: '2025',
    ctor: SchemeTonalSpot,
  },
  {
    key: 'vibrant',
    label: 'Vibrant',
    description: 'Brighter accents with higher chroma.',
    variant: 'VIBRANT',
    roleSpec: '2025',
    ctor: SchemeVibrant,
  },
  {
    key: 'expressive',
    label: 'Expressive',
    description: 'Playful hues and a more chromatic palette.',
    variant: 'EXPRESSIVE',
    roleSpec: '2025',
    ctor: SchemeExpressive,
  },
  {
    key: 'neutral',
    label: 'Neutral',
    description: 'Muted, almost grayscale surfaces with a quiet accent.',
    variant: 'NEUTRAL',
    roleSpec: '2025',
    ctor: SchemeNeutral,
  },
  {
    key: 'monochrome',
    label: 'Monochrome',
    description: 'A single neutral palette, with no hue in the accents.',
    variant: 'MONOCHROME',
    roleSpec: '2021',
    ctor: SchemeMonochrome,
  },
  {
    key: 'fidelity',
    label: 'Fidelity',
    description: 'Stays close to the seed color and its chroma.',
    variant: 'FIDELITY',
    roleSpec: '2021',
    ctor: SchemeFidelity,
  },
  {
    key: 'content',
    label: 'Content',
    description: 'Derives a theme from image-like content, keeping the seed character.',
    variant: 'CONTENT',
    roleSpec: '2021',
    ctor: SchemeContent,
  },
  {
    key: 'rainbow',
    label: 'Rainbow',
    description: 'A spectrum of related hues for a more colorful theme.',
    variant: 'RAINBOW',
    roleSpec: '2021',
    ctor: SchemeRainbow,
  },
  {
    key: 'fruit',
    label: 'Fruit Salad',
    description: 'Juicy, contrasting accents around the seed.',
    variant: 'FRUIT_SALAD',
    roleSpec: '2021',
    ctor: SchemeFruitSalad,
  },
];

export const STYLE_BY_KEY: Record<StyleKey, StyleDef> = Object.fromEntries(
  STYLE_DEFS.map((style) => [style.key, style]),
) as Record<StyleKey, StyleDef>;

const GOOGLE_BLUE = 0xff1b6ef3;
const MIN_CHROMA = 5;

const PALETTE_DEFS: Array<{
  key: string;
  label: string;
  get: (scheme: DynamicScheme) => TonalPalette;
}> = [
  { key: 'primary', label: 'Primary', get: (scheme) => scheme.primaryPalette },
  { key: 'secondary', label: 'Secondary', get: (scheme) => scheme.secondaryPalette },
  { key: 'tertiary', label: 'Tertiary', get: (scheme) => scheme.tertiaryPalette },
  { key: 'neutral', label: 'Neutral', get: (scheme) => scheme.neutralPalette },
  {
    key: 'neutral_variant',
    label: 'Neutral Variant',
    get: (scheme) => scheme.neutralVariantPalette,
  },
  { key: 'error', label: 'Error', get: (scheme) => scheme.errorPalette },
];

const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];

const mdc = new MaterialDynamicColors() as unknown as Record<
  string,
  () => DynamicColor
>;

const mdcCache = new Map<string, DynamicColor>();

function dynamicColor(key: string): DynamicColor {
  const methodName = key.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
  let color = mdcCache.get(methodName);
  if (!color) {
    const method = mdc[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Unknown Material dynamic color: ${methodName}`);
    }
    color = method.call(mdc);
    mdcCache.set(methodName, color);
  }
  return color;
}

export function argbToHex(argb: number): string {
  return hexFromArgb(argb).toLowerCase();
}

export function hctTriple(color: Hct): HctTriple {
  return {
    hue: round(color.hue, 2),
    chroma: round(color.chroma, 2),
    tone: round(color.tone, 2),
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function hexToArgb(hex: string): number {
  const normalized = normalizeHexInput(hex);
  return argbFromHex(normalized);
}

export function normalizeHexInput(input: string): string {
  let value = input.trim();
  if (!value.startsWith('#')) value = `#${value}`;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [r, g, b] = value.slice(1);
    value = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid hex color: ${input}`);
  }
  return value.toLowerCase();
}

function resolveRole(
  key: string,
  scheme: DynamicScheme,
  isDark: boolean,
): number {
  const is2025 = scheme.specVersion === '2025';

  switch (key) {
    // Android-only roles. ColorSpec2025 remaps these three; the remaining
    // Android roles keep their ColorSpec2021 definitions.
    case 'control_activated':
      return is2025
        ? dynamicColor('primary_container').getArgb(scheme)
        : scheme.primaryPalette.tone(isDark ? 30 : 90);
    case 'control_normal':
      return is2025
        ? dynamicColor('on_surface_variant').getArgb(scheme)
        : scheme.neutralVariantPalette.tone(isDark ? 80 : 30);
    case 'text_primary_inverse':
      return is2025
        ? dynamicColor('inverse_on_surface').getArgb(scheme)
        : scheme.neutralPalette.tone(isDark ? 10 : 90);
    case 'control_highlight':
      return scheme.neutralPalette.tone(isDark ? 100 : 0);
    case 'text_hint_inverse':
    case 'text_primary_inverse_disable_only':
    case 'text_secondary_and_tertiary_inverse_disabled':
      return scheme.neutralPalette.tone(isDark ? 10 : 90);
    case 'text_secondary_and_tertiary_inverse':
      return scheme.neutralVariantPalette.tone(isDark ? 30 : 80);
    default:
      return dynamicColor(key).getArgb(scheme);
  }
}

function buildRoleMap(scheme: DynamicScheme): RoleMap {
  const map: RoleMap = {};
  for (const role of ROLE_DEFS) {
    const argb = resolveRole(role.key, scheme, scheme.isDark);
    const hex = hexFromArgb(argb).toLowerCase();
    map[role.key] = {
      key: role.key,
      group: role.group,
      argb,
      hex,
      hct: hctTriple(Hct.fromInt(argb)),
    };
  }
  return map;
}

function buildPalettes(scheme: DynamicScheme): TonalPaletteInfo[] {
  return PALETTE_DEFS.map((def) => {
    const palette = def.get(scheme);
    return {
      key: def.key,
      label: def.label,
      hue: round(palette.hue, 2),
      chroma: round(palette.chroma, 2),
      tones: TONES.map((tone) => {
        const argb = palette.tone(tone);
        return { tone, argb, hex: hexFromArgb(argb).toLowerCase() };
      }),
    };
  });
}

/**
 * Generates the scheme Android produces when ThemePicker asks libmonet for
 * SPEC_2026 with the given style. Android only uses the 2026 dynamic-color
 * spec for the CMF style; TonalSpot (and the other classic styles) fall back
 * to SPEC_2025 roles, while still using the 2025 tonal-spot palette rules.
 */
export function generateScheme(options: SchemeOptions): Scheme {
  const style = STYLE_BY_KEY[options.style] ?? STYLE_BY_KEY.tonal;
  const contrast = Math.min(1, Math.max(-1, options.contrast));
  const requestedHct = Hct.fromInt(options.seedArgb);
  const lowChromaFallback =
    style.key !== 'content' && requestedHct.chroma < MIN_CHROMA;

  const effectiveArgb = lowChromaFallback ? GOOGLE_BLUE : options.seedArgb;
  const effectiveHct = Hct.fromInt(effectiveArgb);

  const ctor = style.ctor;
  const make = (isDark: boolean) =>
    new ctor(
      effectiveHct,
      isDark,
      contrast,
      style.roleSpec,
      options.platform,
    );

  return {
    seedHex: argbToHex(options.seedArgb),
    effectiveSeedHex: argbToHex(effectiveArgb),
    seedHct: hctTriple(requestedHct),
    effectiveSeedHct: hctTriple(effectiveHct),
    lowChromaFallback,
    style: style.key,
    styleLabel: style.label,
    styleDescription: style.description,
    variant: style.variant,
    roleSpec: style.roleSpec,
    platform: options.platform,
    contrast,
    light: buildRoleMap(make(false)),
    dark: buildRoleMap(make(true)),
    palettes: buildPalettes(make(false)),
    roleOrder: ROLE_ORDER,
  };
}

export function roleColors(scheme: Scheme, mode: Mode): RoleMap {
  return mode === 'light' ? scheme.light : scheme.dark;
}

export function schemeCssVariables(scheme: Scheme, mode: Mode): Record<string, string> {
  const colors = roleColors(scheme, mode);
  const vars: Record<string, string> = {};
  for (const [key, color] of Object.entries(colors)) {
    vars[`--md-${key.replaceAll('_', '-')}`] = color.hex;
  }
  return vars;
}

export function relativeLuminance(argb: number): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((argb >> 16) & 0xff);
  const g = channel((argb >> 8) & 0xff);
  const b = channel(argb & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: number, b: number): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
