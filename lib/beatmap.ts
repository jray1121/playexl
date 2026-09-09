import type { BeatMapEntry, TimeSigChange } from "@/types"

/**
 * Given an array of click-track onset timestamps and a time-signature map,
 * builds a full beat map assigning each timestamp a measure + beat position.
 *
 * onsets      — sorted array of timestamps in seconds (one per click)
 * timeSigMap  — sorted by measure ascending; must include an entry for measure 1
 */
export function buildBeatMap(
  onsets: number[],
  timeSigMap: TimeSigChange[],
  hasCountOff = false
): BeatMapEntry[] {
  if (!onsets.length || !timeSigMap.length) return []

  // Sort maps by measure just in case
  const sigMap = [...timeSigMap].sort((a, b) => a.measure - b.measure)

  const beatMap: BeatMapEntry[] = []
  // A cappella pieces typically have a full count-off measure of clicks
  // before the music starts (no piano to give the starting pitch/tempo).
  // Label that lead-in measure 0 so measure 1 always matches the printed score.
  let measure = hasCountOff ? 0 : 1
  let beat = 1
  let sigIndex = 0

  // Find which time sig applies to the current measure
  function currentSig(): TimeSigChange {
    let sig = sigMap[0]
    for (let i = 0; i < sigMap.length; i++) {
      if (sigMap[i].measure <= measure) sig = sigMap[i]
      else break
    }
    return sig
  }

  for (let i = 0; i < onsets.length; i++) {
    const sig = currentSig()
    // How many clicks fill this measure depends on the click note value relative
    // to the denominator. e.g. 6/8 with eighth-note clicks = 6; 4/4 with
    // quarter-note clicks = 4; 4/4 with eighth-note clicks = 8.
    const clickNote = sig.clickNoteValue ?? sig.denominator
    const clicksPerMeasure = (sig.numerator * clickNote) / sig.denominator

    beatMap.push({
      timestamp: onsets[i],
      measure,
      beat,
      timeSig: `${sig.numerator}/${sig.denominator}`,
    })

    beat++
    if (beat > clicksPerMeasure) {
      beat = 1
      measure++
      // Advance sig pointer if next sig starts at new measure
      if (
        sigIndex + 1 < sigMap.length &&
        sigMap[sigIndex + 1].measure <= measure
      ) {
        sigIndex++
      }
    }
  }

  return beatMap
}

/** Given a beat map and a target measure (+ optional beat), return the timestamp. */
export function measureToTimestamp(
  beatMap: BeatMapEntry[],
  measure: number,
  beat = 1
): number | null {
  const entry = beatMap.find(
    (e) => e.measure === measure && e.beat === beat
  )
  return entry ? entry.timestamp : null
}

/** Given a timestamp, return the most recent beat that has already started. */
export function timestampToBeat(
  beatMap: BeatMapEntry[],
  timestamp: number
): BeatMapEntry | null {
  if (!beatMap.length) return null
  let current = beatMap[0]
  for (const entry of beatMap) {
    if (entry.timestamp <= timestamp) {
      current = entry
    } else {
      break
    }
  }
  return current
}

/**
 * Detect onset times from a mono Float32Array of audio samples.
 * Uses simple energy-delta onset detection — good enough for clean click tracks.
 * Returns timestamps in seconds.
 */
export function detectOnsets(
  samples: Float32Array,
  sampleRate: number,
  minIntervalSec = 0.15
): number[] {
  // Find global peak so we can set a relative threshold
  let globalPeak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > globalPeak) globalPeak = abs
  }

  // Threshold at 25% of the global peak — works well for clean click tracks
  const threshold = globalPeak * 0.25
  const minIntervalSamples = minIntervalSec * sampleRate

  const onsets: number[] = []
  let lastOnsetSample = -Infinity
  let inPeak = false

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])

    if (abs >= threshold && !inPeak && i - lastOnsetSample > minIntervalSamples) {
      onsets.push(i / sampleRate)
      lastOnsetSample = i
      inPeak = true
    } else if (abs < threshold * 0.5) {
      inPeak = false
    }
  }

  return onsets
}
