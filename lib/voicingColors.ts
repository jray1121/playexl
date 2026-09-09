// Base brand color assigned to each specific voicing — sampled from the
// printed Cantabile Series catalog banners. These are approximate (pulled by
// eye from scans); swap in exact brand hex values here if/when available.
// Treble (SA/SSA/SSAA) and Tenor-Bass (TB/TTB/TBB/TTBB) share one color each
// across their sub-variants; everything else is its own distinct color.
// Per-member colors for Voctave, sampled from the DAW session rainbow
export const VOCTAVE_MEMBER_COLORS: Record<string, string> = {
  kate:     "#C0392B",
  tiffany:  "#E74C3C",
  ashley:   "#E67E22",
  sarah:    "#D4AC0D",
  chrystal: "#8B9E2A",
  ej:       "#27AE60",
  drew:     "#1A7A4A",
  jamey:    "#17618A",
  kurt:     "#8E44AD",
  johnny:   "#6C3483",
  karl:     "#A569BD",
  click:    "#64748b",
  full_mix: "#94a3b8",
}

export const VOICING_BASE_COLORS: Record<string, string> = {
  Unison: "#9B2D63",
  "Two-Part": "#9B2D63",
  "Three-Part Mixed": "#8C9A5A",
  SAB: "#3D8C97",
  SATB: "#A52A2A",
  SA: "#C7A02E",
  SSA: "#C7A02E",
  SSAA: "#C7A02E",
  TB: "#C2562E",
  TTB: "#C2562E",
  TBB: "#C2562E",
  TTBB: "#C2562E",
  Voctave: "#17618A",
}

export function baseColorForVoicing(voicing: string): string {
  return VOICING_BASE_COLORS[voicing] ?? "#873995"
}

/**
 * Generates `count` distinct shades/tints within the same hue as `baseHex`,
 * ordered light → dark. Since Excelcia assigns one color per voicing (not
 * per voice), individual parts within a voicing are colored as steps around
 * that single base color instead of having independent fixed colors.
 */
export function generatePartColors(baseHex: string, count: number): string[] {
  if (count <= 1) return [baseHex]
  const { h, s, l } = hexToHsl(baseHex)
  const minL = Math.max(22, l - 24)
  const maxL = Math.min(76, l + 24)
  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const lightness = maxL - t * (maxL - minL)
    colors.push(hslToHex(h, s, lightness))
  }
  return colors
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4; break
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
