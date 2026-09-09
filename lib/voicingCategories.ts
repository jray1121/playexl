import { VOICING_BASE_COLORS, VOCTAVE_MEMBER_COLORS, generatePartColors } from "./voicingColors"

// 6 sections used to organize the library page, one per distinct Excelcia
// voicing color (Mixed Voices splits into its 3 real sub-voicings; Treble
// and Tenor-Bass stay combined since their sub-variants share one color).
// `colors` is the
// representative swatch shown on each section's stripe/jump-nav pill —
// built from the real Excelcia brand color(s) for the voicings in that
// section (see lib/voicingColors.ts), not invented colors.
export const VOICING_CATEGORIES = [
  {
    label: "Unison / Two-Part",
    id: "unison-two-part",
    voicings: ["Unison", "Two-Part"],
    // Single shared base color — shown as a couple of shades for visual richness.
    colors: generatePartColors(VOICING_BASE_COLORS["Two-Part"], 2),
  },
  {
    label: "Three-Part Mixed",
    id: "three-part-mixed",
    voicings: ["Three-Part Mixed"],
    colors: generatePartColors(VOICING_BASE_COLORS["Three-Part Mixed"], 3),
  },
  {
    label: "SAB Voices",
    id: "sab-voices",
    voicings: ["SAB"],
    colors: generatePartColors(VOICING_BASE_COLORS.SAB, 3),
  },
  {
    label: "SATB Voices",
    id: "satb-voices",
    voicings: ["SATB"],
    colors: generatePartColors(VOICING_BASE_COLORS.SATB, 4),
  },
  {
    label: "Treble Voices",
    id: "treble-voices",
    voicings: ["SA", "SSA", "SSAA"],
    // Single shared base color across SA/SSA/SSAA — shown as shades.
    colors: generatePartColors(VOICING_BASE_COLORS.SSAA, 4),
  },
  {
    label: "Tenor-Bass",
    id: "tenor-bass",
    voicings: ["TB", "TTB", "TBB", "TTBB"],
    colors: generatePartColors(VOICING_BASE_COLORS.TTBB, 4),
  },
  {
    label: "Voctave",
    id: "voctave",
    voicings: ["Voctave"],
    colors: Object.values(VOCTAVE_MEMBER_COLORS).slice(0, 6),
  },
]

export function categoryFor(voicing: string): string {
  return VOICING_CATEGORIES.find((c) => c.voicings.includes(voicing))?.label ?? "Other"
}

export function categoryById(id: string) {
  return VOICING_CATEGORIES.find((c) => c.id === id)
}
