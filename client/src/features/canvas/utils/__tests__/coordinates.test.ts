import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen, zoomAtScreenPoint } from '../coordinates.js';
import type { CanvasViewport } from '../../types/interaction.js';

describe('Coordinate Conversion Utilities', () => {
  const viewport: CanvasViewport = { x: 100, y: 50, zoom: 2 };

  it('converts screen coordinates to world coordinates correctly', () => {
    const screenX = 300;
    const screenY = 250;
    const world = screenToWorld(screenX, screenY, viewport);

    expect(world.x).toBe((300 - 100) / 2); // 100
    expect(world.y).toBe((250 - 50) / 2);  // 100
  });

  it('converts world coordinates to screen coordinates correctly', () => {
    const worldX = 100;
    const worldY = 100;
    const screen = worldToScreen(worldX, worldY, viewport);

    expect(screen.x).toBe(100 * 2 + 100); // 300
    expect(screen.y).toBe(100 * 2 + 50);  // 250
  });

  it('preserves world point under cursor during zoomAtScreenPoint', () => {
    const screenX = 400;
    const screenY = 300;
    const initialViewport: CanvasViewport = { x: 50, y: 50, zoom: 1 };

    const worldBefore = screenToWorld(screenX, screenY, initialViewport);
    const newViewport = zoomAtScreenPoint(screenX, screenY, initialViewport, 2.0);

    const worldAfter = screenToWorld(screenX, screenY, newViewport);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
    expect(newViewport.zoom).toBe(2.0);
  });

  it('clamps zoom within min and max limits', () => {
    const initialViewport: CanvasViewport = { x: 0, y: 0, zoom: 1 };
    const zoomedOut = zoomAtScreenPoint(100, 100, initialViewport, 0.01, 0.1, 5.0);
    expect(zoomedOut.zoom).toBe(0.1);

    const zoomedIn = zoomAtScreenPoint(100, 100, initialViewport, 10.0, 0.1, 5.0);
    expect(zoomedIn.zoom).toBe(5.0);
  });
});
