import type { Point } from '../../../types/canvas.js';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export type CanvasTool =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'pencil'
  | 'text'
  | 'pan';

export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface HandleDescriptor {
  handle: ResizeHandle;
  x: number;
  y: number;
  size: number;
}

export interface InteractionState {
  mode: 'idle' | 'drawing' | 'moving' | 'resizing' | 'panning';
  activeTool: CanvasTool;
  startPoint: Point | null;
  currentPoint: Point | null;
  activeHandle: ResizeHandle | null;
  draggedObjectId: string | null;
  initialObjectBounds: BoundingBox | null;
  initialObjectPosition: Point | null;
}
