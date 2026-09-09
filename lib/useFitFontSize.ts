"use client"
import { useCallback, useLayoutEffect, useState } from "react"

interface Options {
  min: number
  max: number
}

/**
 * Picks the largest font size (within [min, max]) at which every given line
 * of text fits on a single line within the container's current width.
 * Re-measures on resize, and on mount whenever the container appears
 * (e.g. after a conditional render), via a callback ref rather than a
 * plain RefObject — that way it re-measures even if the element wasn't
 * there yet on earlier renders.
 */
export function useFitFontSize(
  texts: string | string[],
  { min, max }: Options
): [(node: HTMLElement | null) => void, number] {
  const [fontSize, setFontSize] = useState(max)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const ref = useCallback((el: HTMLElement | null) => setNode(el), [])

  const list = Array.isArray(texts) ? texts : [texts]
  const key = list.join("|")

  useLayoutEffect(() => {
    if (!node) return

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function measure() {
      const containerWidth = node!.clientWidth
      if (!containerWidth || !list.some((t) => t.length)) return

      const computed = getComputedStyle(node!)
      const fontWeight = computed.fontWeight
      const fontFamily = computed.fontFamily

      let lo = min
      let hi = max
      let best = min

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        ctx!.font = `${fontWeight} ${mid}px ${fontFamily}`
        const widest = Math.max(...list.map((t) => ctx!.measureText(t).width))
        if (widest <= containerWidth) {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      setFontSize(best)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, key, min, max])

  return [ref, fontSize]
}
