import type { CanvasObject, Point } from '../../../types/canvas.js';
import type { BoundingBox, ResizeHandle } from '../types/interaction.js';
import { distanceToSegment, getObjectBounds, getResizeHandles } from './geometry.js';

/**
 * Tests whether a point in world coordinates hits a specific canvas object.
 * Supports rotation-aware hit testing for transformed geometry and guards against malformed objects.
 */
export function hitTestObject(point: Point, obj: CanvasObject): boolean {
  if (!obj || !point) return false;

  switch (obj.type) {
    case 'rectangle': {
      const width = obj.width * (obj.scaleX ?? 1);
      const height = obj.height * (obj.scaleY ?? 1);
      if (width <= 0 || height <= 0) return false;

      if (!obj.rotation) {
        return (
          point.x >= obj.x &&
          point.x <= obj.x + width &&
          point.y >= obj.y &&
          point.y <= obj.y + height
        );
      }

      // Rotation-aware hit test:
      // Inverse-transform the test point into object-local coordinates centered at (cx, cy)
      const cx = obj.x + width / 2;
      const cy = obj.y + height / 2;
      const dx = point.x - cx;
      const dy = point.y - cy;

      const rad = (-obj.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
    }
    case 'ellipse': {
      const rx = obj.radiusX * (obj.scaleX ?? 1);
      const ry = obj.radiusY * (obj.scaleY ?? 1);
      if (rx <= 0 || ry <= 0) return false;
      const normalizedX = (point.x - obj.x) / rx;
      const normalizedY = (point.y - obj.y) / ry;
      return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
    }
    case 'line': {
      if (!obj.points || obj.points.length < 2 || !obj.points[0] || !obj.points[1]) {
        return false;
      }
      const [p1, p2] = obj.points;
      if (typeof p1.x !== 'number' || typeof p2.x !== 'number') return false;
      const tolerance = Math.max(8, (obj.strokeWidth || 2) * 1.5);
      return distanceToSegment(point, p1, p2) <= tolerance;
    }
    case 'stroke': {
      if (!obj.points || obj.points.length < 2) return false;
      const tolerance = Math.max(8, (obj.strokeWidth || 3) * 1.5);
      for (let i = 0; i < obj.points.length - 1; i++) {
        const pt1 = obj.points[i];
        const pt2 = obj.points[i + 1];
        if (!pt1 || !pt2) continue;
        if (distanceToSegment(point, pt1, pt2) <= tolerance) {
          return true;
        }
      }
      return false;
    }
    case 'text': {
      const bounds = getObjectBounds(obj);
      return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
      );
    }
    default:
      return false;
  }
}

/**
 * Finds the top-most object intersecting a point by scanning in reverse rendering order.
 */
export function findTopObjectAtPoint(
  point: Point,
  objectOrder: string[],
  objects: Record<string, CanvasObject>,
): CanvasObject | null {
  for (let i = objectOrder.length - 1; i >= 0; i--) {
    const objId = objectOrder[i];
    const obj = objects[objId];
    if (obj && hitTestObject(point, obj)) {
      return obj;
    }
  }
  return null;
}

/**
 * Tests whether a point intersects one of the resize handles of a bounding box.
 */
export function hitTestResizeHandle(
  point: Point,
  bounds: BoundingBox,
  handleSize: number,
): ResizeHandle | null {
  const handles = getResizeHandles(bounds, handleSize);
  const tolerance = handleSize;

  for (const h of handles) {
    if (Math.abs(point.x - h.x) <= tolerance && Math.abs(point.y - h.y) <= tolerance) {
      return h.handle;
    }
  }
  return null;
}
