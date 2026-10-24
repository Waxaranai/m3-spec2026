/**
 * Role metadata for the device-accurate Android Material color scheme.
 *
 * The order of ROLE_DEFS is the same order used by the reference SPEC_2026
 * Kotlin dump (and by SystemUI's ColorScheme consumers) so exports are stable.
 */
export type RoleGroup =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'surface'
  | 'outline'
  | 'text';

export interface RoleDef {
  key: string;
  group: RoleGroup;
}

export const GROUP_LABELS: Record<RoleGroup, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
  error: 'Error',
  surface: 'Surface & neutral',
  outline: 'Outline & controls',
  text: 'Text & inverse',
};

export const ROLE_DEFS: RoleDef[] = [
  { key: 'primary', group: 'primary' },
  { key: 'on_primary', group: 'primary' },
  { key: 'primary_container', group: 'primary' },
  { key: 'on_primary_container', group: 'primary' },
  { key: 'primary_dim', group: 'primary' },
  { key: 'on_primary_fixed', group: 'primary' },
  { key: 'on_primary_fixed_variant', group: 'primary' },
  { key: 'primary_fixed', group: 'primary' },
  { key: 'primary_fixed_dim', group: 'primary' },
  { key: 'inverse_primary', group: 'primary' },
  { key: 'primary_palette_key_color', group: 'primary' },

  { key: 'secondary', group: 'secondary' },
  { key: 'on_secondary', group: 'secondary' },
  { key: 'secondary_container', group: 'secondary' },
  { key: 'on_secondary_container', group: 'secondary' },
  { key: 'secondary_dim', group: 'secondary' },
  { key: 'on_secondary_fixed', group: 'secondary' },
  { key: 'on_secondary_fixed_variant', group: 'secondary' },
  { key: 'secondary_fixed', group: 'secondary' },
  { key: 'secondary_fixed_dim', group: 'secondary' },
  { key: 'secondary_palette_key_color', group: 'secondary' },

  { key: 'tertiary', group: 'tertiary' },
  { key: 'on_tertiary', group: 'tertiary' },
  { key: 'tertiary_container', group: 'tertiary' },
  { key: 'on_tertiary_container', group: 'tertiary' },
  { key: 'tertiary_dim', group: 'tertiary' },
  { key: 'on_tertiary_fixed', group: 'tertiary' },
  { key: 'on_tertiary_fixed_variant', group: 'tertiary' },
  { key: 'tertiary_fixed', group: 'tertiary' },
  { key: 'tertiary_fixed_dim', group: 'tertiary' },
  { key: 'tertiary_palette_key_color', group: 'tertiary' },

  { key: 'error', group: 'error' },
  { key: 'on_error', group: 'error' },
  { key: 'error_container', group: 'error' },
  { key: 'on_error_container', group: 'error' },
  { key: 'error_dim', group: 'error' },
  { key: 'error_palette_key_color', group: 'error' },

  { key: 'background', group: 'surface' },
  { key: 'on_background', group: 'surface' },
  { key: 'surface', group: 'surface' },
  { key: 'on_surface', group: 'surface' },
  { key: 'surface_variant', group: 'surface' },
  { key: 'on_surface_variant', group: 'surface' },
  { key: 'surface_dim', group: 'surface' },
  { key: 'surface_bright', group: 'surface' },
  { key: 'surface_container_lowest', group: 'surface' },
  { key: 'surface_container_low', group: 'surface' },
  { key: 'surface_container', group: 'surface' },
  { key: 'surface_container_high', group: 'surface' },
  { key: 'surface_container_highest', group: 'surface' },
  { key: 'inverse_surface', group: 'surface' },
  { key: 'inverse_on_surface', group: 'surface' },
  { key: 'scrim', group: 'surface' },
  { key: 'shadow', group: 'surface' },
  { key: 'surface_tint', group: 'surface' },
  { key: 'neutral_palette_key_color', group: 'surface' },
  { key: 'neutral_variant_palette_key_color', group: 'surface' },

  { key: 'outline', group: 'outline' },
  { key: 'outline_variant', group: 'outline' },
  { key: 'control_activated', group: 'outline' },
  { key: 'control_highlight', group: 'outline' },
  { key: 'control_normal', group: 'outline' },

  { key: 'text_hint_inverse', group: 'text' },
  { key: 'text_primary_inverse', group: 'text' },
  { key: 'text_primary_inverse_disable_only', group: 'text' },
  { key: 'text_secondary_and_tertiary_inverse', group: 'text' },
  { key: 'text_secondary_and_tertiary_inverse_disabled', group: 'text' },
];

/** UI order. Exports use ROLE_DEFS so they match the Android dump exactly. */
export const ROLE_ORDER = ROLE_DEFS.map((role) => role.key);

export function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function humanizeRole(value: string): string {
  const words = value.split('_');
  return words
    .map((word, index) => (index === 0 ? word : word))
    .join(' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
