# Spec 2026 — Material color studio

**Live:** [waxaranai.github.io/m3-spec2026](https://waxaranai.github.io/m3-spec2026/)

A static, browser-only studio that turns an image into a device-accurate Material 3
**SPEC_2026** color scheme. Drop a wallpaper, pick a seed color, and inspect all 67 roles in
light and dark, the six tonal palettes, the tertiary hue rotation, and production-ready
exports.

The site itself is themed with the generated scheme, so the UI updates as you explore.

## What it does

- Extracts a seed from an uploaded image with `QuantizerCelebi` and Material's `Score`
  ranking, locally in the browser.
- Resolves the scheme with [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities)
  0.4.0, including the SPEC_2025 role layer that Android uses for TonalSpot when SPEC_2026
  role definitions do not apply.
- Adds the Android-only roles (`control_*`, `text_*`) from libmonet's `ColorScheme`.
- Shows light/dark phone previews, all roles, all tonal palettes, and the tertiary hue
  rotation.
- Exports Kotlin, JSON, CSS, Android XML, or a Figma variables bundle.
- Supports pixel sampling, pasted hex values, shareable URLs, drag/drop, and paste-to-upload.

## Accuracy notes

This is a color-scheme generator, not a wallpaper extractor that reproduces a specific
device's private `WallpaperManager` pipeline. Image seeds use the public MCU quantizer and
`Score`; a device may choose a slightly different seed from the same wallpaper.

For the reference seed `#2eff2e`, TonalSpot output matches the
[MATERIAL_COLORSCHEME.md gist](https://gist.github.com/Waxaranai/7f2da33dd05f474990349a4cc70d6e23)
role-for-role. The test suite locks those values in.

SPEC_2026 dynamic-color role definitions currently apply to the CMF style. TonalSpot keeps
the 2025 palette recipe and resolves roles through SPEC_2025, which is what the reference
gist shows. The UI calls this out rather than pretending every style gained 2026 roles.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints.

```bash
npm test       # role fidelity, palettes, Figma bundle, ZIP contents
npm run build  # type-check + production build
npm run preview
```

## Figma variables

Choose **Figma variables** in the export panel and download the ZIP. It contains:

- `manifest.json`
- `light.tokens.json`
- `dark.tokens.json`
- `palettes.tokens.json`
- `README.txt`

Unzip the bundle, open Microsoft's
[Variables Import](https://github.com/microsoft/figma-variables-import) plugin in Figma, and
drag all four JSON files into the plugin at once. The manifest creates:

- `M3 Spec 2026` with real **Light** and **Dark** modes and 67 color variables.
- `M3 palettes` with a **Tones** mode and primary, secondary, tertiary, neutral,
  neutral-variant, and error tones.

Each role token also carries a web CSS code syntax such as
`var(--md-sys-color-on-primary)`. The token format is DTCG (`$type: "color"`, `$value:
"#rrggbb"`), which is what the plugin consumes.

The preview in the export panel shows `light.tokens.json`; the ZIP is the part that carries
both modes and the manifest.

## Deploy to GitHub Pages

The Vite build uses a relative base (`base: './'`), so it works from a project subpath or a
custom domain.

1. Create a GitHub repository named `m3-spec2026` and push this directory to `main`.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) runs tests, builds, and publishes
   `dist` on every push to `main`.

The project site will be available at `https://<user>.github.io/m3-spec2026/`.

If you use a different repository name, update the GitHub links in `index.html` (header and
footer). The gist and MCU links are independent of the repository name.

## Project layout

```text
src/
  color/
    engine.ts       scheme creation, role resolution, palettes
    extract.ts      image decoding, quantization, Score, pixel picking
    export.ts       Kotlin/JSON/CSS/XML/Figma serializers and ZIP bundle
    roles.ts        67 role definitions and ordering
    engine.test.ts  fidelity and Figma bundle tests
  icons.ts          inline SVG icon set
  main.ts           UI state, rendering, uploads, exports
  style.css         responsive design system
index.html          page shell
public/sample.svg   sample image
public/favicon.svg  static favicon
```

## Credits

- Material color algorithms:
  [material-color-utilities](https://github.com/material-foundation/material-color-utilities)
  (Apache-2.0).
- Figma token import format:
  [microsoft/figma-variables-import](https://github.com/microsoft/figma-variables-import).
- Reference scheme gist:
  [Waxaranai/MATERIAL_COLORSCHEME.md](https://gist.github.com/Waxaranai/7f2da33dd05f474990349a4cc70d6e23).

Not affiliated with Google. The site does not upload images or send analytics; all image
processing happens in the browser tab.
