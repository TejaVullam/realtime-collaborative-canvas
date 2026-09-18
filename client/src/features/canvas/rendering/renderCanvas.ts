import type { CanvasObject, CanvasState } from '../../../types/canvas.js';
import type { CanvasViewport } from '../types/interaction.js';
import { renderObject } from './renderObject.js';
import { renderSelection } from './renderSelection.js';

export interface RenderCanvasOptions {
  ctx: CanvasRenderingContext2D;
  canvasState: CanvasState;
  viewport: CanvasViewport;
  selectedObjectId: string | null;
  previewObject: CanvasObject | null;
  width: number;
  height: number;
  dpr: number;
}

/**
 * Main rendering loop executing high-DPI scaling, background grid,
 * world transform matrix, object rendering passes, and selection overlays.
 */
export function renderCanvas(options: RenderCanvasOptions): void {
  const {
    ctx,
    canvasState,
    viewport,
    selectedObjectId,
    previewObject,
    width,
    height,
    dpr,
  } = options;

  ctx.save();

  // Reset transform and clear viewport
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);

  // Apply device pixel ratio scaling
  ctx.scale(dpr, dpr);

  // Render canvas background
  renderBackground(ctx, width, height, viewport, canvasState.metadata.backgroundColor || '#0b0f19');

  // Apply viewport pan and zoom transformation matrix
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // Render objects in deterministic order
  for (const objId of canvasState.objectOrder) {
    const obj = canvasState.objects[objId];
    if (obj) {
      renderObject(ctx, obj);
    }
  }

  // Render active creation/interaction preview object if present
  if (previewObject) {
    renderObject(ctx, previewObject);
  }

  // Render selection overlay for active object
  if (selectedObjectId && canvasState.objects[selectedObjectId]) {
    renderSelection(ctx, canvasState.objects[selectedObjectId], viewport);
  }

  ctx.restore();
}

/**
 * Renders an infinite dot grid aligned with viewport transformations.
 */
function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: CanvasViewport,
  bgColor: string,
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const gridSize = 24;
  const scaledGrid = gridSize * viewport.zoom;

  if (scaledGrid < 12) return;

  const offsetX = (viewport.x % scaledGrid + scaledGrid) % scaledGrid;
  const offsetY = (viewport.y % scaledGrid + scaledGrid) % scaledGrid;

  ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';

  const dotRadius = Math.max(1, Math.min(2, 1.2 * viewport.zoom));

  for (let x = offsetX; x < width; x += scaledGrid) {
    for (let y = offsetY; y < height; y += scaledGrid) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
