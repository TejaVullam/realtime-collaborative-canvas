import type { CanvasObject, Point } from '../../../types/canvas.js';
import type { BoundingBox, ResizeHandle } from '../types/interaction.js';
import { distanceToSegment, getObjectBounds, getResizeHandles } from './geometry.js';

/**
 * Tests whether a point in world coordinates hits a specific canvas object.
 */
export function hitTestObject(point: Point, obj: CanvasObject): boolean {
  switch (obj.type) {
    case 'rectangle': {
      const bounds = getObjectBounds(obj);
      return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
      );
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
      const [p1, p2] = obj.points;
      const tolerance = Math.max(8, (obj.strokeWidth || 2) * 1.5);
      return distanceToSegment(point, p1, p2) <= tolerance;
    }
    case 'stroke': {
      const tolerance = Math.max(8, (obj.strokeWidth || 3) * 1.5);
      for (let i = 0; i < obj.points.length - 1; i++) {
        if (distanceToSegment(point, obj.points[i], obj.points[i + 1]) <= tolerance) {
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
