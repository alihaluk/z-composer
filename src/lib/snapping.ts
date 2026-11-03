// Snapping for drag and drop, in millimetres within one band.
import { type TemplateElement } from '../types';

export const GRID_MM = 0.5;
export const SNAP_MM = 1;

export interface Guide {
  axis: 'x' | 'y';
  /** Position in mm: x from the page's left edge, y from the band's top edge. */
  at: number;
}

const snapToGrid = (v: number) => Math.round(v / GRID_MM) * GRID_MM;

function snapAxis(start: number, size: number, targets: number[]): { value: number; guide?: number } {
  let best: { delta: number; guide: number } | null = null;
  for (const edge of [start, start + size / 2, start + size]) {
    for (const target of targets) {
      const delta = target - edge;
      if (Math.abs(delta) <= SNAP_MM && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, guide: target };
    }
  }
  return best ? { value: start + best.delta, guide: best.guide } : { value: snapToGrid(start) };
}

/**
 * Snaps a moving box to the edges and centres of the other elements of its band and to the
 * page centre; otherwise to the grid. Also keeps it inside the page and the band.
 */
export function snapPosition(
  box: { x: number; y: number; width: number; height: number },
  others: TemplateElement[],
  pageWidth: number,
  bandHeight: number,
): { x: number; y: number; guides: Guide[] } {
  const xs = [0, pageWidth / 2, pageWidth, ...others.flatMap(o => [o.x, o.x + o.width / 2, o.x + o.width])];
  const ys = [0, bandHeight, ...others.flatMap(o => [o.y, o.y + o.height / 2, o.y + o.height])];
  const sx = snapAxis(box.x, box.width, xs);
  const sy = snapAxis(box.y, box.height, ys);
  const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(0, v), Math.max(0, max)) * 100) / 100;
  const x = clamp(sx.value, pageWidth - box.width);
  const y = clamp(sy.value, bandHeight - Math.min(box.height, bandHeight));
  const guides: Guide[] = [];
  if (sx.guide !== undefined && x === sx.value) guides.push({ axis: 'x', at: sx.guide });
  if (sy.guide !== undefined && y === sy.value) guides.push({ axis: 'y', at: sy.guide });
  return { x, y, guides };
}
