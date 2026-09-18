import { describe, it, expect } from 'vitest';
import { normalizeBox, distance, distanceToSegment, getObjectBounds, getResizeHandles } from '../geometry.js';
import type { RectangleObject, EllipseObject } from '../../../../types/canvas.js';

describe('Geometry Utilities', () => {
  it('normalizes drag box correctly when dragging top-left to bottom-right', () => {
    const box = normalizeBox({ x: 10, y: 20 }, { x: 110, y: 80 });
    expect(box).toEqual({ x: 10, y: 20, width: 100, height: 60 });
  });

  it('normalizes drag box correctly when dragging bottom-right to top-left', () => {
    const box = normalizeBox({ x: 110, y: 80 }, { x: 10, y: 20 });
    expect(box).toEqual({ x: 10, y: 20, width: 100, height: 60 });
  });

  it('calculates Euclidean distance accurately', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('calculates point to segment distance', () => {
    // Point directly above horizontal segment
    const d1 = distanceToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(d1).toBe(10);

    // Point off to the side of segment
    const d2 = distanceToSegment({ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(d2).toBe(10);
  });

  it('computes accurate bounds for rectangle', () => {
    const rect: RectangleObject = {
      id: 'r1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 1,
      createdAt: 0,
      updatedAt: 0,
      createdBy: 'test',
    };
    const bounds = getObjectBounds(rect);
    expect(bounds).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
      width: 100,
      height: 50,
    });
  });

  it('computes accurate bounds for ellipse', () => {
    const ellipse: EllipseObject = {
      id: 'e1',
      type: 'ellipse',
      x: 100,
      y: 100,
      radiusX: 40,
      radiusY: 30,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 1,
      createdAt: 0,
      updatedAt: 0,
      createdBy: 'test',
    };
    const bounds = getObjectBounds(ellipse);
    expect(bounds).toEqual({
      minX: 60,
      minY: 70,
      maxX: 140,
      maxY: 130,
      width: 80,
      height: 60,
    });
  });

  it('generates 4 corner resize handles with correct coordinates', () => {
    const handles = getResizeHandles({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 80,
      width: 100,
      height: 60,
    }, 8);

    expect(handles).toHaveLength(4);
    const nw = handles.find((h) => h.handle === 'nw');
    const ne = handles.find((h) => h.handle === 'ne');
    const se = handles.find((h) => h.handle === 'se');
    const sw = handles.find((h) => h.handle === 'sw');

    expect(nw).toEqual({ handle: 'nw', x: 10, y: 20, size: 8 });
    expect(ne).toEqual({ handle: 'ne', x: 110, y: 20, size: 8 });
    expect(se).toEqual({ handle: 'se', x: 110, y: 80, size: 8 });
    expect(sw).toEqual({ handle: 'sw', x: 10, y: 80, size: 8 });
  });
});
