import { describe, it, expect } from 'vitest';
import { hitTestObject, findTopObjectAtPoint, hitTestResizeHandle } from '../hitTesting.js';
import type { RectangleObject, EllipseObject, LineObject, CanvasObject } from '../../../../types/canvas.js';

describe('Hit Testing Utilities', () => {
  const rect: RectangleObject = {
    id: 'r1',
    type: 'rectangle',
    x: 50,
    y: 50,
    width: 100,
    height: 100,
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

  const ellipse: EllipseObject = {
    id: 'e1',
    type: 'ellipse',
    x: 100,
    y: 100,
    radiusX: 50,
    radiusY: 50,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 2,
    createdAt: 0,
    updatedAt: 0,
    createdBy: 'test',
  };

  const line: LineObject = {
    id: 'l1',
    type: 'line',
    x: 0,
    y: 0,
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    stroke: '#000000',
    strokeWidth: 4,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 3,
    createdAt: 0,
    updatedAt: 0,
    createdBy: 'test',
  };

  it('detects point inside and outside rectangle correctly', () => {
    expect(hitTestObject({ x: 80, y: 80 }, rect)).toBe(true);
    expect(hitTestObject({ x: 40, y: 40 }, rect)).toBe(false);
    expect(hitTestObject({ x: 160, y: 160 }, rect)).toBe(false);
  });

  it('detects point inside and outside ellipse correctly', () => {
    expect(hitTestObject({ x: 100, y: 100 }, ellipse)).toBe(true);
    expect(hitTestObject({ x: 140, y: 100 }, ellipse)).toBe(true);
    expect(hitTestObject({ x: 155, y: 155 }, ellipse)).toBe(false);
  });

  it('detects point near and far from line correctly', () => {
    expect(hitTestObject({ x: 50, y: 52 }, line)).toBe(true);
    expect(hitTestObject({ x: 50, y: 80 }, line)).toBe(false);
  });

  it('returns the top-most object in reverse rendering order', () => {
    const objects: Record<string, CanvasObject> = {
      r1: rect,
      e1: ellipse,
    };
    const order = ['r1', 'e1']; // e1 is rendered on top of r1

    // Center point (100, 100) hits both rect and ellipse; e1 should be picked
    const top = findTopObjectAtPoint({ x: 100, y: 100 }, order, objects);
    expect(top?.id).toBe('e1');
  });

  it('detects hit on corner resize handles', () => {
    const bounds = { minX: 10, minY: 10, maxX: 100, maxY: 100, width: 90, height: 90 };
    const handleSize = 8;

    const hitNW = hitTestResizeHandle({ x: 12, y: 11 }, bounds, handleSize);
    expect(hitNW).toBe('nw');

    const hitSE = hitTestResizeHandle({ x: 99, y: 101 }, bounds, handleSize);
    expect(hitSE).toBe('se');

    const miss = hitTestResizeHandle({ x: 50, y: 50 }, bounds, handleSize);
    expect(miss).toBeNull();
  });
});
