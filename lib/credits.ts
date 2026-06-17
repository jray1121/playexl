/**
 * Builds the credits lines for a song based on available metadata.
 * Returns an array of strings — one per credit line.
 */
export function buildCredits({
  composer,
  lyricist,
  arranger,
}: {
  composer: string
  lyricist?: string | null
  arranger?: string | null
}): string[] {
  const lines: string[] = []

  if (lyricist && lyricist !== composer) {
    lines.push(`Words by ${lyricist}`)
    lines.push(`Music by ${composer}`)
  } else {
    lines.push(`Words and Music by ${composer}`)
  }

  if (arranger) {
    lines.push(`Arranged by ${arranger}`)
  }

  return lines
}
