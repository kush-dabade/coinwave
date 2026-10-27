/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 * Produces rectangles with areas proportional to `value` and aspect ratios
 * kept close to 1, which keeps small tiles legible.
 */

export type TreemapRect<T> = {
  item: T
  x: number
  y: number
  w: number
  h: number
}

function worst(row: number[], side: number) {
  const sum = row.reduce((a, b) => a + b, 0)
  if (sum <= 0) return Infinity
  const max = Math.max(...row)
  const min = Math.min(...row)
  const s2 = side * side
  const sum2 = sum * sum
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min))
}

export function squarify<T>(
  items: T[],
  value: (item: T) => number,
  width: number,
  height: number
): TreemapRect<T>[] {
  const entries = items
    .map((item) => ({ item, v: value(item) }))
    .filter((e) => Number.isFinite(e.v) && e.v > 0)
    .sort((a, b) => b.v - a.v)
  const total = entries.reduce((sum, e) => sum + e.v, 0)
  if (total <= 0 || width <= 0 || height <= 0) return []

  const scale = (width * height) / total
  const areas = entries.map((e) => e.v * scale)
  const out: TreemapRect<T>[] = []

  let x = 0
  let y = 0
  let w = width
  let h = height
  let i = 0

  while (i < areas.length) {
    const side = Math.min(w, h)
    const row: number[] = [areas[i]]
    let j = i + 1
    while (
      j < areas.length &&
      worst([...row, areas[j]], side) <= worst(row, side)
    ) {
      row.push(areas[j])
      j++
    }
    const rowArea = row.reduce((a, b) => a + b, 0)
    if (w >= h) {
      // Lay the row out as a column on the left.
      const colW = rowArea / h
      let cy = y
      row.forEach((area, k) => {
        const rh = area / colW
        out.push({ item: entries[i + k].item, x, y: cy, w: colW, h: rh })
        cy += rh
      })
      x += colW
      w -= colW
    } else {
      // Lay the row out across the top.
      const rowH = rowArea / w
      let cx = x
      row.forEach((area, k) => {
        const rw = area / rowH
        out.push({ item: entries[i + k].item, x: cx, y, w: rw, h: rowH })
        cx += rw
      })
      y += rowH
      h -= rowH
    }
    i = j
  }
  return out
}
