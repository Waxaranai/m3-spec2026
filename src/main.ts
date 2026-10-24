import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import {
  Hct,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

import './style.css';
import { icons } from './icons';
import {
  STYLE_BY_KEY,
  STYLE_DEFS,
  generateScheme,
  hexToArgb,
  normalizeHexInput,
  type Mode,
  type Platform,
  type RoleMap,
  type Scheme,
  type SpecKey,
  type StyleKey,
} from './color/engine';
import {
  extractSeeds,
  loadImageFile,
  loadImageFromUrl,
  pickColor,
  releaseImage,
  type LoadedImage,
  type SeedCandidate,
} from './color/extract';
import { EXPORT_KINDS, buildFigmaBundle, fileStem, serialize, type ExportKind } from './color/export';
import { GROUP_LABELS, ROLE_DEFS, type RoleGroup } from './color/roles';

interface PickState {
  u: number;
  v: number;
  mx: number;
  my: number;
  hex: string;
}

interface ImageState extends LoadedImage {
  seeds: SeedCandidate[];
  usedFallback: boolean;
  sampledPixels: number;
  uniqueColors: number;
  pick?: PickState;
}

interface State {
  seedArgb: number;
  style: StyleKey;
  spec: SpecKey;
  contrast: number;
  platform: Platform;
  theme: Mode;
  exportKind: ExportKind['id'];
  roleQuery: string;
  image?: ImageState;
  loading: boolean;
  uploadError?: string;
}

const DEMO_SEED = '#2eff2e';
const STORAGE_KEY = 'm3-spec2026:v1';
const PRESET_SEEDS = [
  '#2eff2e',
  '#1b6ef3',
  '#7c4dff',
  '#ff6d00',
  '#e91e63',
  '#00bfa5',
];
const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
const TERTIARY_SEGMENTS = [
  { from: 0, to: 20, rotation: -40 },
  { from: 20, to: 71, rotation: 48 },
  { from: 71, to: 161, rotation: -32 },
  { from: 161, to: 333, rotation: 40 },
  { from: 333, to: 360, rotation: -32 },
];

const $ = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

const state: State = loadState();
let cachedScheme: Scheme | undefined;
let cachedSchemeKey = '';
let renderFrame = 0;
let toastTimer = 0;

const uploadPanel = $<HTMLDivElement>('#upload-panel');
const fileInput = $<HTMLInputElement>('#file-input');
const themeButton = $<HTMLButtonElement>('#theme-btn');
const shareButton = $<HTMLButtonElement>('#share-btn');
const styleSelect = $<HTMLSelectElement>('#style-select');
const styleDescription = $<HTMLElement>('#style-desc');
const specToggle = $<HTMLDivElement>('#spec-toggle');
const specDescription = $<HTMLElement>('#spec-desc');
const roleSpecBadge = $<HTMLElement>('#role-spec-badge');
const platformToggle = $<HTMLDivElement>('#platform-toggle');
const contrastRange = $<HTMLInputElement>('#contrast-range');
const contrastValue = $<HTMLElement>('#contrast-value');
const roleSearch = $<HTMLInputElement>('#role-search');
const roleTableWrap = $<HTMLDivElement>('#role-table-wrap');
const paletteTable = $<HTMLDivElement>('#palette-table');
const tertiaryNote = $<HTMLDivElement>('#tertiary-note');
const exportTabs = $<HTMLDivElement>('#export-tabs');
const exportCode = $<HTMLElement>('#export-code');
const exportFilename = $<HTMLElement>('#export-filename');
const copyExportButton = $<HTMLButtonElement>('#copy-export');
const downloadExportButton = $<HTMLButtonElement>('#download-export');
const toast = $<HTMLDivElement>('#toast');
const toastText = $<HTMLElement>('#toast-text');

init();

function init(): void {
  setStaticIcons();
  populateStyles();
  buildExportTabs();
  renderUpload();
  renderAll();
  attachEvents();
  document.documentElement.classList.add('is-ready');
}

function loadState(): State {
  const defaults: State = {
    seedArgb: argbFromHex(DEMO_SEED),
    style: 'tonal',
    spec: '2026',
    contrast: 0,
    platform: 'phone',
    theme:
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
        ? 'dark'
        : 'light',
    exportKind: 'figma',
    roleQuery: '',
    loading: false,
  };

  let stored: Partial<State> | undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<State>;
  } catch {
    stored = undefined;
  }

  const params = new URLSearchParams(window.location.search);
  const next: State = { ...defaults };

  if (stored) {
    if (typeof stored.seedArgb === 'number') next.seedArgb = stored.seedArgb;
    if (stored.style && STYLE_BY_KEY[stored.style]) next.style = stored.style;
    if (stored.spec === '2021' || stored.spec === '2026') next.spec = stored.spec;
    if (typeof stored.contrast === 'number') next.contrast = clamp(stored.contrast, -1, 1);
    if (stored.platform === 'watch' || stored.platform === 'phone') next.platform = stored.platform;
    if (stored.theme === 'light' || stored.theme === 'dark') next.theme = stored.theme;
    if (stored.exportKind && EXPORT_KINDS.some((kind) => kind.id === stored.exportKind)) {
      next.exportKind = stored.exportKind;
    }
  }

  const seedParam = params.get('seed');
  if (seedParam) {
    try {
      next.seedArgb = hexToArgb(seedParam);
    } catch {
      // Ignore a malformed share link and keep the stored/default seed.
    }
  }

  const styleParam = params.get('style');
  if (styleParam && STYLE_BY_KEY[styleParam as StyleKey]) {
    next.style = styleParam as StyleKey;
  }

  const specParam = params.get('spec');
  if (specParam === '2021' || specParam === '2026') {
    next.spec = specParam;
  }

  const contrastParam = params.get('contrast');
  if (contrastParam !== null) {
    const value = Number(contrastParam);
    if (Number.isFinite(value)) next.contrast = clamp(value, -1, 1);
  }

  const platformParam = params.get('platform');
  if (platformParam === 'watch' || platformParam === 'phone') {
    next.platform = platformParam;
  }

  const themeParam = params.get('theme');
  if (themeParam === 'light' || themeParam === 'dark') {
    next.theme = themeParam;
  }

  return next;
}

function setStaticIcons(): void {
  $<HTMLElement>('#hero-upload-icon').innerHTML = icons.upload;
  $<HTMLElement>('#hero-sample-icon').innerHTML = icons.image;
  shareButton.innerHTML = icons.link;
  $<HTMLElement>('.github-btn').innerHTML = icons.github;
  $<HTMLElement>('.search-icon').innerHTML = icons.search;
  $<HTMLElement>('#note-icon-spec').innerHTML = icons.shield;
  $<HTMLElement>('#note-icon-tertiary').innerHTML = icons.palette;
  $<HTMLElement>('#note-icon-privacy').innerHTML = icons.lock;
  copyExportButton.innerHTML = icons.copy;
  downloadExportButton.innerHTML = icons.download;
  $<HTMLElement>('.toast-icon').innerHTML = icons.check;
}

function populateStyles(): void {
  const group = (label: string, roles: string[]) =>
    `<optgroup label="${label}">${STYLE_DEFS.filter((style) =>
      roles.includes(style.roleSpec),
    )
      .map(
        (style) =>
          `<option value="${style.key}">${style.label}</option>`,
      )
      .join('')}</optgroup>`;

  styleSelect.innerHTML = [
    group('Classic styles', ['2025']),
    group('Legacy styles', ['2021']),
  ].join('');
}

function buildExportTabs(): void {
  exportTabs.innerHTML = EXPORT_KINDS.map(
    (kind) =>
      `<button type="button" role="tab" data-export="${kind.id}" id="export-tab-${kind.id}" aria-controls="export-code">${kind.label}</button>`,
  ).join('');
}

function attachEvents(): void {
  themeButton.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    renderAll();
  });

  shareButton.addEventListener('click', () => {
    syncUrl(currentScheme());
    void copyText(window.location.href, 'Share link copied');
  });

  $<HTMLButtonElement>('#hero-upload-btn').addEventListener('click', () => openFilePicker());
  $<HTMLButtonElement>('#hero-sample-btn').addEventListener('click', () => {
    void loadSampleImage();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void ingestFile(file);
  });

  styleSelect.addEventListener('change', () => {
    const value = styleSelect.value as StyleKey;
    if (STYLE_BY_KEY[value]) {
      state.style = value;
      scheduleRender();
    }
  });

  specToggle.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-spec]');
    const spec = button?.dataset.spec;
    if (spec === '2021' || spec === '2026') {
      state.spec = spec;
      renderAll();
    }
  });

  contrastRange.addEventListener('input', () => {
    state.contrast = clamp(Number(contrastRange.value), -1, 1);
    scheduleRender();
  });

  platformToggle.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-platform]');
    const platform = button?.dataset.platform;
    if (platform === 'phone' || platform === 'watch') {
      state.platform = platform;
      renderAll();
    }
  });

  roleSearch.addEventListener('input', () => {
    state.roleQuery = roleSearch.value;
    renderRoles(currentScheme());
  });

  exportTabs.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-export]');
    const kind = button?.dataset.export as ExportKind['id'] | undefined;
    if (kind && EXPORT_KINDS.some((entry) => entry.id === kind)) {
      state.exportKind = kind;
      renderExport(currentScheme());
      persist();
    }
  });

  copyExportButton.addEventListener('click', () => {
    const kind = activeExportKind();
    void copyText(serialize(currentScheme(), kind.id), `${kind.label} copied`);
  });

  downloadExportButton.addEventListener('click', () => {
    downloadCurrentExport();
  });

  uploadPanel.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    uploadPanel.classList.add('is-dragging');
  });

  uploadPanel.addEventListener('dragleave', (event) => {
    if (event.target === uploadPanel) uploadPanel.classList.remove('is-dragging');
  });

  uploadPanel.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadPanel.classList.remove('is-dragging');
    const file = event.dataTransfer?.files?.[0];
    if (file) void ingestFile(file);
  });

  window.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  window.addEventListener('drop', (event) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });

  document.addEventListener('paste', (event) => {
    const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
      item.type.startsWith('image/'),
    );
    if (file) {
      event.preventDefault();
      void ingestFile(file);
    }
  });

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('input', handleDocumentInput);
  document.addEventListener('change', handleDocumentChange);
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === 'seed-hex' && event.key === 'Enter') {
      target.blur();
    }
  });
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const copyElement = target.closest<HTMLElement>('[data-copy]');
  if (copyElement?.dataset.copy) {
    void copyText(copyElement.dataset.copy, `${copyElement.dataset.copy} copied`);
    flashCopied(copyElement);
    return;
  }

  const seedElement = target.closest<HTMLElement>('[data-seed]');
  if (seedElement?.dataset.seed) {
    try {
      setSeed(hexToArgb(seedElement.dataset.seed));
      showToast(`Seed ${seedElement.dataset.seed}`);
    } catch {
      showToast('That seed could not be used');
    }
    return;
  }

  if (target.closest('#dropzone') || target.closest('#change-image-btn')) {
    openFilePicker();
    return;
  }

  if (target.closest('#clear-image-btn')) {
    clearImage();
    return;
  }

  if (target.closest('#shuffle-seed')) {
    randomSeed();
    return;
  }

  if (target.closest('#source-image')) {
    handleImageClick(event);
  }
}

function handleDocumentInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === 'seed-color') {
    try {
      setSeed(argbFromHex(target.value));
    } catch {
      // Native color inputs always provide a valid value.
    }
    return;
  }

  if (target.id === 'seed-hex') {
    const raw = target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
    if (raw !== target.value) target.value = raw;
    if (/^[0-9a-f]{6}$/i.test(raw)) {
      target.classList.remove('is-invalid');
      const argb = argbFromHex(raw);
      if (argb !== state.seedArgb) setSeed(argb);
    }
  }
}

function handleDocumentChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.id !== 'seed-hex') return;

  try {
    const hex = normalizeHexInput(target.value);
    target.value = hex.slice(1);
    target.classList.remove('is-invalid');
    setSeed(hexToArgb(hex));
  } catch {
    target.classList.add('is-invalid');
    target.value = currentScheme().seedHex.slice(1);
    showToast('Enter a six-digit hex color');
  }
}

function openFilePicker(): void {
  if (state.loading) return;
  fileInput.click();
}

async function ingestFile(file: File): Promise<void> {
  await ingestImage(() => loadImageFile(file), 'Found {n} seed colors');
}

async function loadSampleImage(): Promise<void> {
  if (state.loading) return;
  const url = new URL('sample.svg', document.baseURI).href;
  await ingestImage(() => loadImageFromUrl(url, 'Chroma garden (sample)'), 'Sample image loaded');
}

async function ingestImage(
  loader: () => Promise<LoadedImage>,
  successMessage: string,
): Promise<void> {
  if (state.loading) return;
  state.loading = true;
  state.uploadError = undefined;
  renderUpload();
  await paint();

  let loaded: LoadedImage | undefined;
  try {
    loaded = await loader();
    const extraction = extractSeeds(loaded);
    const previous = state.image;

    state.image = {
      ...loaded,
      ...extraction,
      pick: undefined,
    };
    state.seedArgb = extraction.seeds[0].argb;
    state.loading = false;
    state.uploadError = undefined;

    renderUpload();
    renderAll();
    releaseImage(previous);
    showToast(successMessage.replace('{n}', String(extraction.seeds.length)));
  } catch (error) {
    if (loaded) releaseImage(loaded);
    state.loading = false;
    state.uploadError =
      error instanceof Error ? error.message : 'That image could not be read.';
    renderUpload();
    showToast('Could not read that image');
  }
}

function clearImage(): void {
  if (!state.image) return;
  releaseImage(state.image);
  state.image = undefined;
  state.uploadError = undefined;
  state.seedArgb = argbFromHex(DEMO_SEED);
  renderUpload();
  renderAll();
  showToast('Back to the demo seed');
}

function setSeed(argb: number, pick?: Omit<PickState, 'hex'>): void {
  if (argb === state.seedArgb && !pick) return;
  state.seedArgb = argb;
  if (state.image) {
    state.image.pick = pick ? { ...pick, hex: hexFromArgb(argb).toLowerCase() } : undefined;
  }
  renderAll();
  positionPickMarker();
}

function randomSeed(): void {
  const hue = Math.random() * 360;
  const chroma = 28 + Math.random() * 72;
  const tone = 42 + Math.random() * 38;
  const argb = Hct.from(hue, chroma, tone).toInt();
  setSeed(argb);
  showToast(`Random seed ${hexFromArgb(argb).toLowerCase()}`);
}

function handleImageClick(event: MouseEvent): void {
  if (!state.image) return;
  const image = uploadPanel.querySelector<HTMLImageElement>('#source-image');
  if (!image) return;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const imageAspect = state.image.width / state.image.height;
  const boxAspect = rect.width / rect.height;
  let u: number;
  let v: number;

  if (imageAspect > boxAspect) {
    const drawnWidth = rect.height * imageAspect;
    u = (event.clientX - rect.left + (drawnWidth - rect.width) / 2) / drawnWidth;
    v = (event.clientY - rect.top) / rect.height;
  } else {
    const drawnHeight = rect.width / imageAspect;
    u = (event.clientX - rect.left) / rect.width;
    v = (event.clientY - rect.top + (drawnHeight - rect.height) / 2) / drawnHeight;
  }

  try {
    const picked = pickColor(state.image, clamp(u, 0, 1), clamp(v, 0, 1));
    setSeed(picked.argb, {
      u: clamp(u, 0, 1),
      v: clamp(v, 0, 1),
      mx: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      my: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    });
    showToast(`Sampled ${picked.hex}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not sample that pixel');
  }
}

function positionPickMarker(): void {
  const shell = uploadPanel.querySelector<HTMLElement>('.image-shell');
  if (!shell) return;
  let marker = shell.querySelector<HTMLElement>('.pick-marker');
  const pick = state.image?.pick;

  if (!pick) {
    marker?.remove();
    return;
  }

  if (!marker) {
    marker = document.createElement('span');
    marker.className = 'pick-marker';
    shell.append(marker);
  }
  marker.style.left = `${pick.mx * 100}%`;
  marker.style.top = `${pick.my * 100}%`;
  marker.style.setProperty('--pick-color', pick.hex);
  marker.title = `Sampled ${pick.hex}`;
}

function scheduleRender(): void {
  if (renderFrame) return;
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = 0;
    renderAll();
  });
}

function currentScheme(): Scheme {
  const key = `${state.seedArgb}|${state.style}|${state.spec}|${state.contrast}|${state.platform}`;
  if (!cachedScheme || key !== cachedSchemeKey) {
    cachedScheme = generateScheme({
      seedArgb: state.seedArgb,
      style: state.style,
      spec: state.spec,
      contrast: state.contrast,
      platform: state.platform,
    });
    cachedSchemeKey = key;
  }
  return cachedScheme;
}

function renderAll(): void {
  const scheme = currentScheme();
  applyTheme(scheme);
  renderHero(scheme);
  renderControls(scheme);
  renderGlance(scheme);
  renderSeedMeta(scheme);
  renderSpectrum(scheme);
  renderPhones(scheme);
  renderRoles(scheme);
  renderPalettes(scheme);
  renderTertiaryNote(scheme);
  renderExport(scheme);
  updateSeedUI(scheme);
  syncUrl(scheme);
  persist();
}

function applyTheme(scheme: Scheme): void {
  const root = document.documentElement;
  root.dataset.theme = state.theme;
  root.style.colorScheme = state.theme;

  const colors = scheme[state.theme];
  for (const [key, color] of Object.entries(colors)) {
    root.style.setProperty(`--md-${key.replaceAll('_', '-')}`, color.hex);
  }

  const meta = document.querySelector<HTMLMetaElement>('#meta-theme-color');
  meta?.setAttribute('content', colors.surface.hex);

  themeButton.innerHTML = state.theme === 'dark' ? icons.sun : icons.moon;
  themeButton.title = state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  themeButton.setAttribute('aria-label', themeButton.title);
  themeButton.setAttribute('aria-pressed', String(state.theme === 'dark'));

  updateFavicon(scheme);
}

function updateFavicon(scheme: Scheme): void {
  const colors = scheme[state.theme];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${colors.surface}"/><rect x="8" y="8" width="22" height="22" rx="7" fill="${colors.primary}"/><rect x="34" y="8" width="22" height="22" rx="7" fill="${colors.secondary}"/><rect x="8" y="34" width="22" height="22" rx="7" fill="${colors.tertiary}"/><rect x="34" y="34" width="22" height="22" rx="7" fill="${colors.error}"/></svg>`;
  const favicon = document.querySelector<HTMLLinkElement>('#favicon');
  if (favicon) favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function renderHero(scheme: Scheme): void {
  const colors = scheme[state.theme];
  $<HTMLElement>('#hero-seed-label').textContent = scheme.seedHex;
  $<HTMLElement>('#hero-hct').textContent = `HCT ${scheme.seedHct.hue} · ${scheme.seedHct.chroma} · ${scheme.seedHct.tone}`;

  const orb = $<HTMLElement>('#hero-orb');
  orb.style.background = `radial-gradient(circle at 32% 26%, ${colors.primary_container.hex}, ${scheme.effectiveSeedHex} 54%, ${colors.tertiary.hex})`;

  const ticketRoles = ['primary', 'secondary', 'tertiary', 'error'] as const;
  $<HTMLElement>('#hero-ticket-rows').innerHTML = ticketRoles
    .map((key) => {
      const color = colors[key];
      return `<div class="ticket-row">
        <span class="ticket-swatch" style="background:${color.hex}"></span>
        <span>${humanize(key)}</span>
        <span class="mono">${color.hex}</span>
      </div>`;
    })
    .join('');

  const paletteBars = [
    ...scheme.palettes[0].tones.slice(1, 9),
    ...scheme.palettes[2].tones.slice(1, 9),
  ];
  $<HTMLElement>('#hero-palette').innerHTML = paletteBars
    .map((tone) => `<span style="background:${tone.hex}"></span>`)
    .join('');

  $<HTMLElement>('#hero-sticker').textContent = `SPEC_${scheme.roleSpec} roles`;
  $<HTMLElement>('#ticket-spec').textContent = `SPEC_${scheme.requestedSpec}`;
  const footerStyle = document.querySelector<HTMLElement>('.ticket-footer span:first-child');
  if (footerStyle) footerStyle.textContent = `Scheme${scheme.styleLabel.replace(/[^a-z]/gi, '')}`;

  $<HTMLElement>('#role-ribbon').innerHTML = scheme.roleOrder
    .map((key) => {
      const color = colors[key];
      return `<span style="background:${color.hex}" title="${key} ${color.hex}"></span>`;
    })
    .join('');
}

function renderControls(scheme: Scheme): void {
  styleSelect.value = state.style;
  styleDescription.textContent = scheme.styleDescription;
  roleSpecBadge.textContent = `SPEC_${scheme.roleSpec} roles`;
  roleSpecBadge.title =
    scheme.requestedSpec === '2021'
      ? 'SPEC_2021 roles and original 2021 palette recipes'
      : `Requested SPEC_2026 → resolved SPEC_${scheme.roleSpec} for ${scheme.styleLabel}`;
  roleSpecBadge.dataset.roleSpec = scheme.roleSpec;

  specDescription.textContent =
    state.spec === '2021'
      ? 'Original 2021 roles and palette recipes, including the +60° tertiary hue.'
      : '2026 resolution: classic styles use 2025 roles; legacy styles stay on 2021.';

  for (const button of specToggle.querySelectorAll<HTMLElement>('[data-spec]')) {
    const active = button.dataset.spec === state.spec;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  for (const button of platformToggle.querySelectorAll<HTMLElement>('[data-platform]')) {
    const active = button.dataset.platform === state.platform;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  contrastValue.textContent = formatContrast(state.contrast);
  if (document.activeElement !== contrastRange) {
    contrastRange.value = String(state.contrast);
  }
  contrastRange.setAttribute('aria-valuetext', formatContrast(state.contrast));
}

function renderGlance(scheme: Scheme): void {
  const colors = scheme[state.theme];
  const tiles: Array<{
    label: string;
    background: string;
    foreground: string;
    copy: string;
    accent?: string;
  }> = [
    {
      label: 'Primary',
      background: colors.primary.hex,
      foreground: colors.on_primary.hex,
      copy: colors.primary.hex,
    },
    {
      label: 'Secondary',
      background: colors.secondary.hex,
      foreground: colors.on_secondary.hex,
      copy: colors.secondary.hex,
    },
    {
      label: 'Tertiary',
      background: colors.tertiary.hex,
      foreground: colors.on_tertiary.hex,
      copy: colors.tertiary.hex,
    },
    {
      label: 'Error',
      background: colors.error.hex,
      foreground: colors.on_error.hex,
      copy: colors.error.hex,
    },
    {
      label: 'Surface',
      background: colors.surface_container.hex,
      foreground: colors.on_surface.hex,
      copy: colors.surface.hex,
      accent: colors.outline_variant.hex,
    },
    {
      label: 'Outline',
      background: colors.surface_container_highest.hex,
      foreground: colors.on_surface.hex,
      copy: colors.outline.hex,
      accent: colors.outline.hex,
    },
  ];

  $<HTMLElement>('#glance-grid').innerHTML = tiles
    .map(
      (tile) => `<button class="glance-tile" type="button" data-copy="${tile.copy}"
        style="--tile-bg:${tile.background};--tile-fg:${tile.foreground};--tile-accent:${tile.accent ?? 'transparent'}"
        title="Copy ${tile.copy}">
        <span class="tile-name">${tile.label}</span>
        <span class="tile-hex mono">${tile.copy}</span>
        <span class="tile-line" aria-hidden="true"></span>
      </button>`,
    )
    .join('');
}

function renderSeedMeta(scheme: Scheme): void {
  const primary = scheme.palettes.find((palette) => palette.key === 'primary');
  const secondary = scheme.palettes.find((palette) => palette.key === 'secondary');
  const tertiary = scheme.palettes.find((palette) => palette.key === 'tertiary');
  const fallback = scheme.lowChromaFallback
    ? `<p class="inline-warning"><strong>Low chroma fallback.</strong> Android substitutes Google Blue for non-content styles when the seed's chroma is below 5.</p>`
    : '';

  $<HTMLElement>('#seed-meta').innerHTML = `
    <div class="seed-meta-top">
      <span class="mini-label">Active seed</span>
      <button class="meta-chip mono" type="button" data-copy="${scheme.seedHex}">${scheme.seedHex}</button>
      ${
        scheme.lowChromaFallback
          ? `<span class="meta-arrow">→</span><button class="meta-chip mono" type="button" data-copy="${scheme.effectiveSeedHex}">${scheme.effectiveSeedHex}</button>`
          : ''
      }
      <span class="meta-hct mono">H ${scheme.seedHct.hue} · C ${scheme.seedHct.chroma} · T ${scheme.seedHct.tone}</span>
    </div>
    ${fallback}
    <div class="meta-grid">
      <div><span>Variant</span><strong class="mono">${scheme.variant}</strong></div>
      <div><span>Role spec</span><strong class="mono">SPEC_${scheme.roleSpec}</strong></div>
      <div><span>Platform</span><strong>${scheme.platform === 'phone' ? 'Phone' : 'Watch'}</strong></div>
      <div><span>Contrast</span><strong class="mono">${formatContrast(scheme.contrast)}</strong></div>
    </div>
    <div class="recipe-grid">
      <div><span>Primary</span><strong>H ${primary?.hue} · C ${primary?.chroma}</strong></div>
      <div><span>Secondary</span><strong>H ${secondary?.hue} · C ${secondary?.chroma}</strong></div>
      <div><span>Tertiary</span><strong>H ${tertiary?.hue} · C ${tertiary?.chroma}</strong></div>
    </div>`;
}

function renderSpectrum(scheme: Scheme): void {
  const colors = scheme[state.theme];
  $<HTMLElement>('#spectrum-caption').textContent = `${scheme.roleOrder.length} roles · ${state.theme}`;
  $<HTMLElement>('#spectrum').innerHTML = scheme.roleOrder
    .map((key) => {
      const color = colors[key];
      return `<span style="background:${color.hex}" title="${key} ${color.hex}"></span>`;
    })
    .join('');
}

function renderPhones(scheme: Scheme): void {
  $<HTMLElement>('#phone-stage').innerHTML = [
    phoneTemplate(scheme, 'light'),
    phoneTemplate(scheme, 'dark'),
  ].join('');
}

function phoneTemplate(scheme: Scheme, mode: Mode): string {
  const colors = scheme[mode];
  const vars = phoneVars(colors);
  const modeIcon = mode === 'light' ? icons.sun : icons.moon;

  return `<article class="phone-card">
    <div class="phone ${mode}" style="${vars}" aria-hidden="true">
      <div class="phone-screen">
        <div class="p-status"><span class="mono">9:41</span><span class="p-status-icons"><i></i><i></i><i></i></span></div>
        <div class="p-appbar">
          <span class="p-icon">${icons.menu}</span>
          <span class="p-title">Spec 2026</span>
          <span class="p-avatar">S</span>
        </div>
        <div class="p-scroll">
          <div class="p-hero">
            <span class="p-kicker">YOUR PALETTE</span>
            <h3>Material,<br />made yours.</h3>
            <p>67 roles from one seed.</p>
            <div class="p-actions">
              <span class="p-btn filled">Explore</span>
              <span class="p-btn tonal">Share</span>
            </div>
          </div>
          <div class="p-tiles">
            <div class="p-tile"><span class="p-tile-icon">${icons.layers}</span><strong>6</strong><small>palettes</small></div>
            <div class="p-tile"><span class="p-tile-icon">${icons.palette}</span><strong>67</strong><small>roles</small></div>
          </div>
          <div class="p-chips">
            <span class="p-chip primary">Primary</span>
            <span class="p-chip tertiary">Tertiary</span>
            <span class="p-chip error">Error</span>
          </div>
          <div class="p-palette">
            <div class="p-palette-head"><span>Primary tonal palette</span><span class="mono">H ${scheme.palettes[0].hue}°</span></div>
            <div class="p-palette-strip">
              ${scheme.palettes[0].tones
                .map((tone) => `<span style="background:${tone.hex}" title="${tone.tone} · ${tone.hex}"></span>`)
                .join('')}
            </div>
          </div>
          <div class="p-list">
            <div class="p-item"><span class="p-dot"></span><div><strong>Surface containers</strong><small>Five levels of depth</small></div></div>
            <div class="p-item"><span class="p-dot alt"></span><div><strong>${scheme.styleLabel}</strong><small>SPEC_${scheme.roleSpec} roles</small></div></div>
            <div class="p-item"><span class="p-dot seed"></span><div><strong>${scheme.effectiveSeedHex}</strong><small>Source seed</small></div></div>
          </div>
        </div>
        <div class="p-nav">
          <span class="p-nav-item active">${icons.home}<i></i></span>
          <span class="p-nav-item">${icons.searchSmall}</span>
          <span class="p-nav-item">${icons.grid}</span>
          <span class="p-nav-item">${icons.settings}</span>
        </div>
        <span class="p-fab">${icons.plus}</span>
      </div>
    </div>
    <div class="phone-meta">
      <span class="mode-pill">${modeIcon} ${mode === 'light' ? 'Light' : 'Dark'}</span>
      <span class="mono">${scheme.effectiveSeedHex}</span>
    </div>
  </article>`;
}

function phoneVars(colors: RoleMap): string {
  const value = (key: string) => colors[key].hex;
  return [
    `--p:${value('primary')}`,
    `--on-p:${value('on_primary')}`,
    `--pc:${value('primary_container')}`,
    `--on-pc:${value('on_primary_container')}`,
    `--p-dim:${value('primary_dim')}`,
    `--s:${value('secondary')}`,
    `--on-s:${value('on_secondary')}`,
    `--sc:${value('secondary_container')}`,
    `--on-sc:${value('on_secondary_container')}`,
    `--surf:${value('surface')}`,
    `--on-surf:${value('on_surface')}`,
    `--surf-var:${value('surface_variant')}`,
    `--on-surf-var:${value('on_surface_variant')}`,
    `--surf-low:${value('surface_container_low')}`,
    `--surf-high:${value('surface_container_high')}`,
    `--surf-highest:${value('surface_container_highest')}`,
    `--outline:${value('outline')}`,
    `--outline-var:${value('outline_variant')}`,
    `--ter:${value('tertiary')}`,
    `--on-ter:${value('on_tertiary')}`,
    `--ter-c:${value('tertiary_container')}`,
    `--on-ter-c:${value('on_tertiary_container')}`,
    `--err:${value('error')}`,
    `--on-err:${value('on_error')}`,
    `--err-c:${value('error_container')}`,
    `--on-err-c:${value('on_error_container')}`,
    `--inv-surf:${value('inverse_surface')}`,
    `--inv-on-surf:${value('inverse_on_surface')}`,
  ].join(';');
}

function renderRoles(scheme: Scheme): void {
  const query = state.roleQuery.trim().toLowerCase();
  const groupOrder = Object.keys(GROUP_LABELS) as RoleGroup[];
  const activeGroups = groupOrder
    .map((group) => {
      const roles = ROLE_DEFS.filter(
        (role) =>
          role.group === group &&
          (!query ||
            role.key.includes(query) ||
            GROUP_LABELS[group].toLowerCase().includes(query)),
      );
      return { group, roles };
    })
    .filter((entry) => entry.roles.length > 0);

  if (activeGroups.length === 0) {
    roleTableWrap.innerHTML = `<div class="empty-state">No roles match “${escapeHtml(state.roleQuery)}”. <button type="button" id="clear-role-search">Clear filter</button></div>`;
    roleTableWrap.querySelector('#clear-role-search')?.addEventListener('click', () => {
      state.roleQuery = '';
      roleSearch.value = '';
      renderRoles(currentScheme());
    });
    return;
  }

  const groups = activeGroups
    .map(({ group, roles }) => {
      const rows = roles
        .map((role) => {
          const light = scheme.light[role.key];
          const dark = scheme.dark[role.key];
          return `<div class="role-row" role="row" data-role="${role.key}">
            <div class="role-name" role="cell"><code title="${role.key}">${role.key}</code></div>
            ${colorCell('light', role.key, light.hex, light.hct)}
            ${colorCell('dark', role.key, dark.hex, dark.hct)}
          </div>`;
        })
        .join('');
      return `<div class="role-group" role="rowgroup">
        <div class="role-group-head" role="row"><span>${GROUP_LABELS[group]}</span><span>${roles.length} ${roles.length === 1 ? 'role' : 'roles'}</span></div>
        ${rows}
      </div>`;
    })
    .join('');

  roleTableWrap.innerHTML = `<div class="role-table" role="table" aria-label="Material color roles">
    <div class="role-row role-head" role="row">
      <span role="columnheader">Role</span>
      <span role="columnheader">Light</span>
      <span role="columnheader">Dark</span>
    </div>
    ${groups}
  </div>`;
}

function colorCell(
  mode: Mode,
  role: string,
  hex: string,
  hct: { hue: number; chroma: number; tone: number },
): string {
  return `<div class="role-cell ${mode}" role="cell" data-mode="${mode}">
    <button class="color-cell" type="button" data-copy="${hex}"
      aria-label="Copy ${role} ${mode} ${hex}"
      title="${mode} · ${hex} · HCT ${hct.hue} / ${hct.chroma} / ${hct.tone}">
      <span class="swatch" style="background:${hex}"></span>
      <span class="hex mono">${hex}</span>
      <span class="copy-glyph" aria-hidden="true">${icons.copy}</span>
    </button>
  </div>`;
}

function renderPalettes(scheme: Scheme): void {
  const head = TONES.map((tone) => `<th scope="col">${tone}</th>`).join('');
  const rows = scheme.palettes
    .map(
      (palette) => `<tr>
        <th scope="row" class="palette-name">
          <span>${palette.label}</span>
          <span class="palette-hct mono">H ${palette.hue}° · C ${palette.chroma}</span>
        </th>
        ${palette.tones
          .map(
            (tone) => `<td>
              <button class="tone-cell" type="button" data-copy="${tone.hex}"
                style="--tone:${tone.hex}"
                title="${palette.label} ${tone.tone} — ${tone.hex}"
                aria-label="Copy ${palette.label} tone ${tone.tone}, ${tone.hex}">
                <span class="tone-label mono">${tone.tone}</span>
              </button>
            </td>`,
          )
          .join('')}
      </tr>`,
    )
    .join('');

  paletteTable.innerHTML = `<table class="palette-table">
    <thead><tr><th scope="col" class="palette-corner">Palette</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTertiaryNote(scheme: Scheme): void {
  const seedHue = scheme.effectiveSeedHct.hue;
  const tertiary = scheme.palettes.find((palette) => palette.key === 'tertiary');
  const tertiaryHue = tertiary?.hue ?? 0;
  const active = TERTIARY_SEGMENTS.find(
    (segment) => seedHue >= segment.from && seedHue < segment.to,
  );
  const isTonal = scheme.style === 'tonal';
  const is2021 = scheme.requestedSpec === '2021';

  let description: string;
  let rotationRows: string;

  if (is2021) {
    description = isTonal
      ? `The original 2021 TonalSpot recipe rotates the seed hue by <strong>+60°</strong> and uses chroma <strong>${tertiary?.chroma}</strong>. That is the classic Material You tertiary; the 2026 request replaces it with a piecewise rotation.`
      : `The 2021 ${scheme.styleLabel} recipe derives tertiary independently. It lands at <strong>${tertiaryHue}°</strong> with chroma <strong>${tertiary?.chroma}</strong>.`;
    rotationRows = isTonal
      ? `<div class="rotation-row is-active">
          <span class="mono">TonalSpot 2021</span>
          <strong>+60°</strong>
        </div>
        <div class="rotation-row">
          <span class="mono">Tertiary chroma</span>
          <strong>${tertiary?.chroma}</strong>
        </div>
        <div class="rotation-row">
          <span class="mono">Role spec</span>
          <strong>SPEC_2021</strong>
        </div>`
      : `<div class="rotation-row is-active">
          <span class="mono">${scheme.styleLabel} 2021</span>
          <strong>own recipe</strong>
        </div>
        <div class="rotation-row">
          <span class="mono">Tertiary hue</span>
          <strong>${tertiaryHue}°</strong>
        </div>
        <div class="rotation-row">
          <span class="mono">Tertiary chroma</span>
          <strong>${tertiary?.chroma}</strong>
        </div>`;
  } else {
    description = isTonal && active
      ? `Seed hue <strong>${seedHue}°</strong> falls in <code>[${active.from}°, ${active.to}°)</code>, so the rotation is <strong>${formatRotation(active.rotation)}</strong>. Tertiary lands at <strong>${tertiaryHue}°</strong> with chroma <strong>${tertiary?.chroma}</strong>.`
      : `This style (${scheme.styleLabel}) has its own tertiary recipe. The table below describes the TonalSpot piecewise rotation, where a green seed produces yellow-green rather than cyan.`;
    rotationRows = TERTIARY_SEGMENTS.map(
      (segment) => `<div class="rotation-row${isTonal && segment === active ? ' is-active' : ''}">
        <span class="mono">[${segment.from}°, ${segment.to}°)</span>
        <strong>${formatRotation(segment.rotation)}</strong>
      </div>`,
    ).join('');
  }

  tertiaryNote.innerHTML = `<div class="tertiary-copy">
      <span class="mini-label">Why this tertiary?</span>
      <h3>${seedHue}° <span class="hue-arrow">→</span> ${tertiaryHue}°</h3>
      <p>${description}</p>
      <div class="hue-track" aria-hidden="true">
        <span class="hue-dot seed" style="left:${clamp(seedHue / 3.6, 0, 100)}%"></span>
        <span class="hue-dot tertiary" style="left:${clamp(tertiaryHue / 3.6, 0, 100)}%"></span>
      </div>
      <div class="hue-legend">
        <span><i class="legend-dot seed"></i>Seed ${seedHue}°</span>
        <span><i class="legend-dot tertiary"></i>Tertiary ${tertiaryHue}°</span>
      </div>
    </div>
    <div class="rotation-list">${rotationRows}</div>`;
}

function renderExport(scheme: Scheme): void {
  const kind = activeExportKind();
  const isFigma = kind.id === 'figma';
  exportCode.textContent = serialize(scheme, kind.id);
  exportFilename.textContent = isFigma
    ? `${fileStem(scheme)}.figma.zip`
    : `${fileStem(scheme)}.${kind.extension}`;

  copyExportButton.title = isFigma ? 'Copy light-mode tokens' : `Copy ${kind.label}`;
  copyExportButton.setAttribute('aria-label', copyExportButton.title);
  downloadExportButton.title = isFigma
    ? 'Download Figma bundle (.zip)'
    : `Download ${kind.label}`;
  downloadExportButton.setAttribute('aria-label', downloadExportButton.title);

  const hint = document.querySelector<HTMLElement>('#export-hint');
  if (hint) {
    hint.hidden = !isFigma;
    hint.innerHTML = isFigma
      ? `<strong>Figma bundle.</strong> The preview shows <code>light.tokens.json</code>. Download the ZIP, unzip it, then drag <code>manifest.json</code>, <code>light.tokens.json</code>, <code>dark.tokens.json</code>, and <code>palettes.tokens.json</code> into Microsoft's <a href="https://github.com/microsoft/figma-variables-import" target="_blank" rel="noreferrer">Variables Import</a> plugin. The manifest creates a collection with real Light and Dark modes.`
      : '';
  }

  for (const tab of exportTabs.querySelectorAll<HTMLElement>('[data-export]')) {
    const active = tab.dataset.export === kind.id;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
}

function renderUpload(): void {
  const image = state.image;
  const seedHex = hexFromArgb(state.seedArgb).toLowerCase();
  const errorMarkup = state.uploadError
    ? `<p class="upload-error">${icons.close}${escapeHtml(state.uploadError)}</p>`
    : '';

  const dropzone = `<button class="dropzone" id="dropzone" type="button" aria-label="Upload an image">
    <span class="drop-icon">${icons.upload}</span>
    <strong>Drop an image here</strong>
    <span>or click to browse</span>
    <span class="drop-note">PNG, JPEG, WebP, AVIF, GIF, SVG · processed locally</span>
  </button>`;

  const imageShell = image
    ? `<div class="image-shell">
        <img id="source-image" src="${image.url}" alt="${escapeHtml(image.name)}" draggable="false" />
        <div class="image-topline">
          <span class="image-badge">${icons.image}<span>${escapeHtml(image.name)}</span></span>
          <span class="image-actions">
            <button class="mini-btn" id="change-image-btn" type="button">Change</button>
            <button class="icon-btn tiny" id="clear-image-btn" type="button" title="Remove image" aria-label="Remove image">${icons.close}</button>
          </span>
        </div>
        <span class="pick-hint">${icons.palette}Click a spot to sample</span>
        <span class="image-dim mono">${image.width} × ${image.height}</span>
      </div>`
    : dropzone;

  const chips = image
    ? image.seeds
        .map((seed) => seedChip(seed.hex, seed.hct))
        .join('')
    : PRESET_SEEDS.map((hex) => {
        const hct = Hct.fromInt(argbFromHex(hex));
        return seedChip(hex, {
          hue: Math.round(hct.hue * 100) / 100,
          chroma: Math.round(hct.chroma * 100) / 100,
          tone: Math.round(hct.tone * 100) / 100,
        });
      }).join('');

  const chipsLabel = image
    ? `<div class="seed-chips-label"><span>Extracted seeds</span><span class="mono">${image.sampledPixels.toLocaleString()} px · ${image.uniqueColors} colors</span></div>`
    : `<div class="seed-chips-label"><span>Try a seed</span><span>Android Score ranking</span></div>`;

  const imageNote = image?.usedFallback
    ? `<p class="inline-warning">The image is mostly grayscale, so the Material fallback seed is shown.</p>`
    : '';

  const loading = state.loading
    ? `<div class="panel-loading" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <strong>Reading colors…</strong>
        <span>Quantizing on this device</span>
      </div>`
    : '';

  uploadPanel.classList.toggle('has-image', Boolean(image));
  uploadPanel.classList.toggle('is-loading', state.loading);
  uploadPanel.setAttribute('aria-busy', String(state.loading));
  uploadPanel.innerHTML = `${imageShell}${errorMarkup}
    <div class="seed-row">
      <label class="seed-color" title="Pick a custom seed">
        <input type="color" id="seed-color" value="${seedHex}" aria-label="Seed color" />
        <span class="seed-color-chip" style="--chip:${seedHex}"></span>
      </label>
      <label class="seed-hex-field" for="seed-hex">
        <span>Seed hex</span>
        <span class="hex-input"><span>#</span><input id="seed-hex" value="${seedHex.slice(1)}" maxlength="6" spellcheck="false" autocomplete="off" aria-label="Seed hex" /></span>
      </label>
      <button class="icon-btn" id="shuffle-seed" type="button" title="Random seed" aria-label="Random seed">${icons.shuffle}</button>
    </div>
    ${imageNote}
    ${chipsLabel}
    <div class="seed-chips">${chips}</div>
    ${loading}`;
}

function seedChip(hex: string, hct: { hue: number; chroma: number; tone: number }): string {
  return `<button class="seed-chip" type="button" data-seed="${hex}" style="--chip:${hex}"
    title="${hex} · HCT ${hct.hue} / ${hct.chroma} / ${hct.tone}"
    aria-label="Use seed ${hex}">
    <span class="chip-swatch"></span>
    <span class="mono">${hex.slice(1)}</span>
    <span class="chip-check" aria-hidden="true">${icons.check}</span>
  </button>`;
}

function updateSeedUI(scheme: Scheme): void {
  const seedHex = scheme.seedHex;
  const colorInput = document.querySelector<HTMLInputElement>('#seed-color');
  if (colorInput) colorInput.value = seedHex;

  const hexInput = document.querySelector<HTMLInputElement>('#seed-hex');
  if (hexInput && document.activeElement !== hexInput) {
    hexInput.value = seedHex.slice(1);
    hexInput.classList.remove('is-invalid');
  }

  for (const chip of document.querySelectorAll<HTMLElement>('[data-seed]')) {
    const selected = chip.dataset.seed === seedHex;
    chip.classList.toggle('is-selected', selected);
    chip.setAttribute('aria-pressed', String(selected));
  }

  const seedValue = document.querySelector<HTMLElement>('#hero-seed-label');
  if (seedValue) seedValue.textContent = seedHex;
}

function syncUrl(scheme: Scheme): void {
  if (window.location.protocol === 'file:') return;
  const url = new URL(window.location.href);
  const params = new URLSearchParams();
  params.set('seed', scheme.seedHex.slice(1));
  if (state.style !== 'tonal') params.set('style', state.style);
  if (state.spec !== '2026') params.set('spec', state.spec);
  if (state.contrast !== 0) params.set('contrast', state.contrast.toFixed(2));
  if (state.platform !== 'phone') params.set('platform', state.platform);
  if (state.theme !== 'light') params.set('theme', state.theme);
  url.search = params.toString();
  if (url.href !== window.location.href) {
    window.history.replaceState(null, '', url);
  }
  document.title = `${scheme.seedHex} · Spec ${scheme.requestedSpec}`;
}

function persist(): void {
  try {
    const scheme = currentScheme();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        seedArgb: state.seedArgb,
        seedHex: scheme.seedHex,
        style: state.style,
        spec: state.spec,
        contrast: state.contrast,
        platform: state.platform,
        theme: state.theme,
        exportKind: state.exportKind,
      }),
    );
  } catch {
    // Storage may be unavailable in private mode; the app still works.
  }
}

function activeExportKind(): ExportKind {
  return (
    EXPORT_KINDS.find((kind) => kind.id === state.exportKind) ??
    EXPORT_KINDS[0]
  );
}

function downloadCurrentExport(): void {
  const scheme = currentScheme();
  const kind = activeExportKind();

  if (kind.id === 'figma') {
    const bytes = buildFigmaBundle(scheme);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/zip' });
    downloadBlob(blob, `${fileStem(scheme)}.figma.zip`);
    showToast('Downloaded Figma bundle');
    return;
  }

  const text = serialize(scheme, kind.id);
  const mime: Record<Exclude<ExportKind['id'], 'figma'>, string> = {
    json: 'application/json',
    kotlin: 'text/plain',
    css: 'text/css',
    xml: 'application/xml',
  };
  const blob = new Blob([text], { type: `${mime[kind.id]};charset=utf-8` });
  const filename = `${fileStem(scheme)}.${kind.extension}`;
  downloadBlob(blob, filename);
  showToast(`Downloaded ${filename}`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string, message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  showToast(message);
}

function flashCopied(element: HTMLElement): void {
  element.classList.add('is-copied');
  window.setTimeout(() => element.classList.remove('is-copied'), 1200);
}

function showToast(message: string): void {
  toastText.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function formatContrast(value: number): string {
  if (Math.abs(value) < 0.005) return '0.00';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
}

function formatRotation(value: number): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}°`;
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function paint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

