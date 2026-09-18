import type { CanvasObject, Point } from '../../../types/canvas.js';
import type { BoundingBox, HandleDescriptor, ResizeHandle } from '../types/interaction.js';

/**
 * Normalizes two points into a non-negative bounding box (x, y, width, height).
 */
export function normalizeBox(p1: Point, p2: Point): { x: number; y: number; width: number; height: number } {
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const width = Math.abs(p2.x - p1.x);
  const height = Math.abs(p2.y - p1.y);
  return { x, y, width, height };
}

/**
 * Calculates Euclidean distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates minimum distance from a point P to a line segment AB.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  if (l2 === 0) return distance(p, a);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
  const projection: Point = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
  return distance(p, projection);
}

/**
 * Computes axis-aligned bounding box for any CanvasObject in world coordinates.
 */
export function getObjectBounds(obj: CanvasObject): BoundingBox {
  switch (obj.type) {
    case 'rectangle': {
      const minX = obj.x;
      const minY = obj.y;
      const width = obj.width * (obj.scaleX ?? 1);
      const height = obj.height * (obj.scaleY ?? 1);
      return {
        minX,
        minY,
        maxX: minX + width,
        maxY: minY + height,
        width,
        height,
      };
    }
    case 'ellipse': {
      const rx = obj.radiusX * (obj.scaleX ?? 1);
      const ry = obj.radiusY * (obj.scaleY ?? 1);
      return {
        minX: obj.x - rx,
        minY: obj.y - ry,
        maxX: obj.x + rx,
        maxY: obj.y + ry,
        width: rx * 2,
        height: ry * 2,
      };
    }
    case 'line': {
      const p1 = obj.points[0];
      const p2 = obj.points[1];
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxX = Math.max(p1.x, p2.x);
      const maxY = Math.max(p1.y, p2.y);
      return {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1),
      };
    }
    case 'stroke': {
      if (!obj.points.length) {
        return { minX: obj.x, minY: obj.y, maxX: obj.x, maxY: obj.y, width: 0, height: 0 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of obj.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
      return {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1),
      };
    }
    case 'text': {
      const width = obj.width ?? (obj.text.length * obj.fontSize * 0.6);
      const height = obj.height ?? (obj.fontSize * 1.2);
      return {
        minX: obj.x,
        minY: obj.y,
        maxX: obj.x + width,
        maxY: obj.y + height,
        width,
        height,
      };
    }
  }
}

/**
 * Returns corner resize handle descriptors for a given bounding box.
 */
export function getResizeHandles(bounds: BoundingBox, handleSize = 8): HandleDescriptor[] {
  const handles: ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];
  return handles.map((handle) => {
    let x = bounds.minX;
    let y = bounds.minY;
    if (handle === 'ne') {
      x = bounds.maxX;
      y = bounds.minY;
    } else if (handle === 'se') {
      x = bounds.maxX;
      y = bounds.maxY;
    } else if (handle === 'sw') {
      x = bounds.minX;
      y = bounds.maxY;
    }
    return {
      handle,
      x,
      y,
      size: handleSize,
    };
  });
}
