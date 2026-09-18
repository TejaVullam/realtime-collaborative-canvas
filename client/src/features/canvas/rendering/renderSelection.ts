import type { CanvasObject } from '../../../types/canvas.js';
import { getObjectBounds, getResizeHandles } from '../utils/geometry.js';
import type { CanvasViewport } from '../types/interaction.js';

/**
 * Renders the selection bounding box and corner resize handles for a selected object.
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  viewport: CanvasViewport,
): void {
  const bounds = getObjectBounds(obj);
  const padding = 4 / viewport.zoom;
  const handleSize = 8 / viewport.zoom;

  ctx.save();

  // Draw selection bounding box
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5 / viewport.zoom;
  ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);

  const minX = bounds.minX - padding;
  const minY = bounds.minY - padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  ctx.strokeRect(minX, minY, width, height);
  ctx.setLineDash([]);

  // Draw 4 corner resize handles
  const handles = getResizeHandles(
    {
      minX,
      minY,
      maxX: minX + width,
      maxY: minY + height,
      width,
      height,
    },
    handleSize,
  );

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / viewport.zoom;

  for (const h of handles) {
    const half = h.size / 2;
    ctx.fillRect(h.x - half, h.y - half, h.size, h.size);
    ctx.strokeRect(h.x - half, h.y - half, h.size, h.size);
  }

  ctx.restore();
}
