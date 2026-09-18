import type { Point } from '../../../types/canvas.js';
import type { CanvasViewport } from '../types/interaction.js';

/**
 * Converts screen/pointer coordinates to world/canvas coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: CanvasViewport,
): Point {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

/**
 * Converts world/canvas coordinates to screen coordinates.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: CanvasViewport,
): Point {
  return {
    x: worldX * viewport.zoom + viewport.x,
    y: worldY * viewport.zoom + viewport.y,
  };
}

/**
 * Computes a new viewport centered around a specific screen anchor point (e.g. mouse cursor).
 */
export function zoomAtScreenPoint(
  screenX: number,
  screenY: number,
  currentViewport: CanvasViewport,
  targetZoom: number,
  minZoom = 0.1,
  maxZoom = 5.0,
): CanvasViewport {
  const clampedZoom = Math.min(Math.max(targetZoom, minZoom), maxZoom);
  if (clampedZoom === currentViewport.zoom) {
    return currentViewport;
  }

  const worldX = (screenX - currentViewport.x) / currentViewport.zoom;
  const worldY = (screenY - currentViewport.y) / currentViewport.zoom;

  return {
    x: screenX - worldX * clampedZoom,
    y: screenY - worldY * clampedZoom,
    zoom: clampedZoom,
  };
}
