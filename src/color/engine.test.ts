import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { STYLE_DEFS, generateScheme } from './engine';
import { buildFigmaBundle, figmaBundleFiles, fileStem, serialize } from './export';
import { ROLE_DEFS } from './roles';

const scheme = generateScheme({
  seedArgb: 0xff2eff2e,
  style: 'tonal',
  contrast: 0,
  platform: 'phone',
});

const scheme2021 = generateScheme({
  seedArgb: 0xff2eff2e,
  style: 'tonal',
  spec: '2021',
  contrast: 0,
  platform: 'phone',
});

/**
 * Reference values from the MATERIAL_COLORSCHEME.md gist for seed #2eff2e.
 * These are the values Android's ThemePicker emits for TonalSpot.
 */
const gistLight: Record<string, string> = {
  primary: '#44683c',
  on_primary: '#ebffe0',
  primary_container: '#c5eeb6',
  on_primary_container: '#375a30',
  primary_dim: '#395b31',
  on_primary_fixed: '#25471f',
  on_primary_fixed_variant: '#416439',
  primary_fixed: '#c5eeb6',
  primary_fixed_dim: '#b7e0a9',
  inverse_primary: '#cdf7be',
  secondary: '#54634e',
  on_secondary: '#edfee3',
  secondary_container: '#d7e8cd',
  on_secondary_container: '#475642',
  secondary_dim: '#485743',
  on_secondary_fixed: '#354330',
  on_secondary_fixed_variant: '#51604b',
  secondary_fixed: '#d7e8cd',
  secondary_fixed_dim: '#c9d9bf',
  tertiary: '#62622c',
  on_tertiary: '#fffcb7',
  tertiary_container: '#f9f7b2',
  on_tertiary_container: '#5f5e29',
  tertiary_dim: '#565521',
  on_tertiary_fixed: '#4c4c18',
  on_tertiary_fixed_variant: '#696932',
  tertiary_fixed: '#f9f7b2',
  tertiary_fixed_dim: '#ebe9a5',
  error: '#a73b21',
  on_error: '#fff7f6',
  error_container: '#fd795a',
  on_error_container: '#6e1400',
  background: '#f9faf2',
  on_background: '#2e342b',
  surface: '#f9faf2',
  on_surface: '#2e342b',
  surface_variant: '#dee5d7',
  on_surface_variant: '#5a6156',
  surface_dim: '#d6dccf',
  surface_bright: '#f9faf2',
  surface_container_lowest: '#ffffff',
  surface_container_low: '#f2f5eb',
  surface_container: '#ebefe4',
  surface_container_high: '#e5eade',
  surface_container_highest: '#dee5d7',
  outline: '#767d71',
  outline_variant: '#adb4a7',
  inverse_surface: '#0c0f0b',
  inverse_on_surface: '#9b9e97',
  scrim: '#000000',
  surface_tint: '#44683c',
  error_dim: '#791903',
  error_palette_key_color: '#c75236',
  neutral_palette_key_color: '#757871',
  neutral_variant_palette_key_color: '#72796e',
  primary_palette_key_color: '#5b8052',
  secondary_palette_key_color: '#6c7c66',
  shadow: '#000000',
  tertiary_palette_key_color: '#7b7a41',
};

const gistDark: Record<string, string> = {
  primary: '#b0cfa4',
  on_primary: '#2d4726',
  primary_container: '#3e5937',
  on_primary_container: '#ccecc0',
  primary_dim: '#a3c197',
  on_primary_fixed: '#2c4626',
  on_primary_fixed_variant: '#476340',
  primary_fixed: '#ccecbf',
  primary_fixed_dim: '#beddb1',
  inverse_primary: '#4b6643',
  secondary: '#bbcbb2',
  on_secondary: '#364431',
  secondary_container: '#313f2c',
  on_secondary_container: '#b4c4ab',
  secondary_dim: '#adbea5',
  on_secondary_fixed: '#354330',
  on_secondary_fixed_variant: '#51604b',
  secondary_fixed: '#d7e8cd',
  secondary_fixed_dim: '#c9d9bf',
  tertiary: '#fffdb9',
  on_tertiary: '#62612c',
  tertiary_container: '#f0efaa',
  on_tertiary_container: '#5a5924',
  tertiary_dim: '#e8e6a3',
  on_tertiary_fixed: '#4c4c18',
  on_tertiary_fixed_variant: '#696932',
  tertiary_fixed: '#f9f7b2',
  tertiary_fixed_dim: '#ebe9a5',
  error: '#f97758',
  on_error: '#450900',
  error_container: '#85230a',
  on_error_container: '#ff9b82',
  background: '#0c0f0b',
  on_background: '#e1e8da',
  surface: '#0c0f0b',
  on_surface: '#e1e8da',
  surface_variant: '#21271f',
  on_surface_variant: '#a7ada1',
  surface_dim: '#0c0f0b',
  surface_bright: '#282e25',
  surface_container_lowest: '#000000',
  surface_container_low: '#10140f',
  surface_container: '#161b14',
  surface_container_high: '#1c211a',
  surface_container_highest: '#21271f',
  outline: '#71776c',
  outline_variant: '#434a40',
  inverse_surface: '#f9faf2',
  inverse_on_surface: '#535650',
  scrim: '#000000',
  surface_tint: '#b0cfa4',
  error_dim: '#c44f34',
  error_palette_key_color: '#c75236',
  neutral_palette_key_color: '#757871',
  neutral_variant_palette_key_color: '#72796e',
  primary_palette_key_color: '#627f5a',
  secondary_palette_key_color: '#6c7c66',
  shadow: '#000000',
  tertiary_palette_key_color: '#7b7a41',
};

function paletteTone(key: string, tone: number): string {
  const palette = scheme.palettes.find((entry) => entry.key === key);
  const entry = palette?.tones.find((value) => value.tone === tone);
  if (!entry) throw new Error(`Missing ${key} tone ${tone}`);
  return entry.hex;
}

function paletteTone2021(key: string, tone: number): string {
  const palette = scheme2021.palettes.find((entry) => entry.key === key);
  const entry = palette?.tones.find((value) => value.tone === tone);
  if (!entry) throw new Error(`Missing ${key} tone ${tone}`);
  return entry.hex;
}

describe('SPEC_2026 TonalSpot for seed #2eff2e', () => {
  it('requests SPEC_2026 and resolves the device role spec', () => {
    expect(scheme.requestedSpec).toBe('2026');
    expect(scheme.roleSpec).toBe('2025');
  });

  it('matches the reference gist role values in light mode', () => {
    for (const [role, hex] of Object.entries(gistLight)) {
      expect(scheme.light[role]?.hex, role).toBe(hex);
    }
  });

  it('matches the reference gist role values in dark mode', () => {
    for (const [role, hex] of Object.entries(gistDark)) {
      expect(scheme.dark[role]?.hex, role).toBe(hex);
    }
  });

  it('resolves every Android-only role using libmonet definitions', () => {
    expect(scheme.light.control_activated.hex).toBe(scheme.light.primary_container.hex);
    expect(scheme.light.control_normal.hex).toBe(scheme.light.on_surface_variant.hex);
    expect(scheme.light.text_primary_inverse.hex).toBe(scheme.light.inverse_on_surface.hex);

    expect(scheme.light.control_highlight.hex).toBe(paletteTone('neutral', 0));
    expect(scheme.dark.control_highlight.hex).toBe(paletteTone('neutral', 100));
    expect(scheme.light.text_hint_inverse.hex).toBe(paletteTone('neutral', 90));
    expect(scheme.dark.text_hint_inverse.hex).toBe(paletteTone('neutral', 10));
    expect(scheme.light.text_primary_inverse_disable_only.hex).toBe(paletteTone('neutral', 90));
    expect(scheme.dark.text_primary_inverse_disable_only.hex).toBe(paletteTone('neutral', 10));
    expect(scheme.light.text_secondary_and_tertiary_inverse.hex).toBe(
      paletteTone('neutral_variant', 80),
    );
    expect(scheme.dark.text_secondary_and_tertiary_inverse.hex).toBe(
      paletteTone('neutral_variant', 30),
    );
    expect(scheme.light.text_secondary_and_tertiary_inverse_disabled.hex).toBe(
      paletteTone('neutral', 90),
    );
    expect(scheme.dark.text_secondary_and_tertiary_inverse_disabled.hex).toBe(
      paletteTone('neutral', 10),
    );
  });

  it('uses the 2025 tonal-spot palette recipe', () => {
    const [primary, secondary, tertiary, neutral, neutralVariant, error] = scheme.palettes;
    expect(primary).toMatchObject({ hue: 142.71, chroma: 32 });
    expect(secondary).toMatchObject({ hue: 142.71, chroma: 16 });
    expect(tertiary).toMatchObject({ hue: 110.71, chroma: 28 });
    expect(neutral).toMatchObject({ hue: 142.71, chroma: 5 });
    expect(neutralVariant).toMatchObject({ hue: 142.71, chroma: 8.5 });
    expect(error).toMatchObject({ hue: 32, chroma: 60 });
    expect(primary.tones.find((tone) => tone.tone === 40)?.hex).toBe('#44673b');
    expect(primary.tones.find((tone) => tone.tone === 90)?.hex).toBe('#c5eeb6');
  });

  it('exports the complete role set', () => {
    expect(ROLE_DEFS).toHaveLength(67);
    expect(Object.keys(scheme.light)).toHaveLength(67);
    expect(Object.keys(scheme.dark)).toHaveLength(67);
  });

  it('resolves every role for every style and platform', () => {
    for (const style of STYLE_DEFS) {
      for (const platform of ['phone', 'watch'] as const) {
        const resolved = generateScheme({
          seedArgb: 0xff2eff2e,
          style: style.key,
          contrast: 0,
          platform,
        });
        expect(Object.keys(resolved.light), `${style.key}/${platform}`).toHaveLength(67);
        for (const role of ROLE_DEFS) {
          expect(resolved.light[role.key].hex, `${style.key}/${platform}/${role.key}`).toMatch(
            /^#[0-9a-f]{6}$/,
          );
          expect(resolved.dark[role.key].hex, `${style.key}/${platform}/${role.key}`).toMatch(
            /^#[0-9a-f]{6}$/,
          );
        }
      }
    }
  });
});

describe('Figma variables export', () => {
  const files = figmaBundleFiles(scheme);
  const manifest = JSON.parse(files['manifest.json']) as {
    name: string;
    collections: Record<string, { modes: Record<string, string[]> }>;
  };

  it('creates a manifest with real light and dark modes', () => {
    expect(manifest.collections['M3 Spec 2026'].modes).toEqual({
      Light: ['light.tokens.json'],
      Dark: ['dark.tokens.json'],
    });
    expect(manifest.collections['M3 palettes 2026'].modes).toEqual({
      Tones: ['palettes.tokens.json'],
    });
  });

  it('uses the DTCG color tokens supported by figma-variables-import', () => {
    const light = JSON.parse(files['light.tokens.json']) as Record<
      string,
      { $type: string; $value: string; $extensions?: Record<string, string> }
    >;
    const dark = JSON.parse(files['dark.tokens.json']) as Record<
      string,
      { $type: string; $value: string }
    >;

    const lightRoles = Object.keys(light).filter((key) => !key.startsWith('$'));
    const darkRoles = Object.keys(dark).filter((key) => !key.startsWith('$'));
    expect(lightRoles).toHaveLength(67);
    expect(darkRoles).toHaveLength(67);
    expect(light.primary).toMatchObject({ $type: 'color', $value: '#44683c' });
    expect(dark.primary).toMatchObject({ $type: 'color', $value: '#b0cfa4' });
    expect(light.on_primary.$extensions?.codeSyntax).toBe('var(--md-sys-color-on-primary)');
    expect(light.on_primary.$extensions?.codeSyntaxPlatform).toBe('WEB');
  });

  it('includes every tonal palette tone', () => {
    const palettes = JSON.parse(files['palettes.tokens.json']) as Record<
      string,
      Record<string, { $type: string; $value: string }>
    >;
    expect(palettes.primary['0'].$value).toBe('#000000');
    expect(palettes.primary['40'].$value).toBe('#44673b');
    expect(palettes.error['40'].$value).toBe('#a63a20');
    expect(Object.keys(palettes).filter((key) => !key.startsWith('$'))).toHaveLength(6);
    for (const key of ['primary', 'secondary', 'tertiary', 'neutral', 'neutral_variant', 'error']) {
      expect(Object.keys(palettes[key])).toHaveLength(13);
    }
  });

  it('builds a ZIP that contains the whole plugin-ready bundle', () => {
    const unzipped = unzipSync(buildFigmaBundle(scheme));
    expect(Object.keys(unzipped).sort()).toEqual(
      [
        'README.txt',
        'dark.tokens.json',
        'light.tokens.json',
        'manifest.json',
        'palettes.tokens.json',
      ].sort(),
    );
    const unzippedManifest = JSON.parse(strFromU8(unzipped['manifest.json'])) as {
      collections: Record<string, unknown>;
    };
    expect(unzippedManifest.collections).toHaveProperty('M3 Spec 2026');
  });
});

describe('SPEC_2021 TonalSpot', () => {
  it('uses the original 2021 roles and palette recipes', () => {
    expect(scheme2021.requestedSpec).toBe('2021');
    expect(scheme2021.roleSpec).toBe('2021');

    const [primary, secondary, tertiary, neutral, neutralVariant, error] =
      scheme2021.palettes;
    expect(primary).toMatchObject({ hue: 142.71, chroma: 36 });
    expect(secondary).toMatchObject({ hue: 142.71, chroma: 16 });
    expect(tertiary).toMatchObject({ hue: 202.71, chroma: 24 });
    expect(neutral).toMatchObject({ hue: 142.71, chroma: 6 });
    expect(neutralVariant).toMatchObject({ hue: 142.71, chroma: 8 });
    expect(error).toMatchObject({ hue: 25, chroma: 84 });
    expect(scheme2021.light.primary.hex).not.toBe(scheme.light.primary.hex);
    expect(scheme2021.light.tertiary.hex).not.toBe(scheme.light.tertiary.hex);
  });

  it('resolves Android-only roles with the 2021 mappings', () => {
    expect(scheme2021.light.control_activated.hex).toBe(paletteTone2021('primary', 90));
    expect(scheme2021.dark.control_activated.hex).toBe(paletteTone2021('primary', 30));
    expect(scheme2021.light.control_normal.hex).toBe(
      paletteTone2021('neutral_variant', 30),
    );
    expect(scheme2021.dark.control_normal.hex).toBe(
      paletteTone2021('neutral_variant', 80),
    );
    expect(scheme2021.light.text_primary_inverse.hex).toBe(
      paletteTone2021('neutral', 90),
    );
    expect(scheme2021.dark.text_primary_inverse.hex).toBe(
      paletteTone2021('neutral', 10),
    );
    expect(scheme2021.light.text_secondary_and_tertiary_inverse.hex).toBe(
      paletteTone2021('neutral_variant', 80),
    );
  });

  it('labels exports as SPEC_2021 and keeps Figma collections distinct', () => {
    const json = JSON.parse(serialize(scheme2021, 'json')) as {
      spec: { requested: string; roleSpec: string };
    };
    expect(json.spec.requested).toBe('SPEC_2021');
    expect(json.spec.roleSpec).toBe('SPEC_2021');
    expect(fileStem(scheme2021)).toBe('m3-spec2021-2eff2e-tonal');

    const files = figmaBundleFiles(scheme2021);
    const manifest = JSON.parse(files['manifest.json']) as {
      collections: Record<string, { modes: Record<string, string[]> }>;
    };
    expect(manifest.collections['M3 Spec 2021'].modes).toEqual({
      Light: ['light.tokens.json'],
      Dark: ['dark.tokens.json'],
    });
    expect(manifest.collections['M3 palettes 2021'].modes).toEqual({
      Tones: ['palettes.tokens.json'],
    });
    expect(files['README.txt']).toContain('requested SPEC_2021');
    expect(files['light.tokens.json']).toContain('SPEC_2021');
  });
});
