// Canvas zoom helpers.
/** Horizontal room taken by the canvas padding and the band labels, in screen pixels. */
const CANVAS_CHROME_PX = 160;

/** Zoom at which a page of the given width fits an area, rounded down to 10 %. */
export const fitZoom = (areaWidth: number, pageWidthPx: number) =>
  Math.max(0.5, Math.min(4, Math.floor(((areaWidth - CANVAS_CHROME_PX) / pageWidthPx) * 10) / 10));
