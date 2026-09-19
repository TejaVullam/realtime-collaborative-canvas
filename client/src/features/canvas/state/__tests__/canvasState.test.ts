import { describe, it, expect } from 'vitest';
import {
  canvasStateReducer,
  createInitialCanvasState,
} from '../canvasState.js';
import type { RectangleObject, CanvasState } from '../../../../types/canvas.js';

describe('Canvas State Reducer (Unit Tests)', () => {
  const sampleRect: RectangleObject = {
    id: 'rect-1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    fill: '#3b82f6',
    stroke: '#1d4ed8',
    strokeWidth: 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 0,
    createdAt: 1000,
    updatedAt: 1000,
    createdBy: 'test-user',
  };

  it('creates clean initial canvas state with default metadata and version 1', () => {
    const initialState = createInitialCanvasState('custom-canvas-id');
    expect(initialState.canvasId).toBe('custom-canvas-id');
    expect(initialState.version).toBe(1);
    expect(initialState.objectOrder).toEqual([]);
    expect(Object.keys(initialState.objects)).toHaveLength(0);
    expect(initialState.metadata.name).toBe('Untitled Workspace');
  });

  it('handles ADD_OBJECT: adds object, updates order, increments version, updates metadata.updatedAt', () => {
    const state = createInitialCanvasState();
    const beforeTime = state.metadata.updatedAt;

    const nextState = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: sampleRect,
    });

    expect(nextState.objects['rect-1']).toEqual(sampleRect);
    expect(nextState.objectOrder).toEqual(['rect-1']);
    expect(nextState.version).toBe(state.version + 1);
    expect(nextState.metadata.updatedAt).toBeGreaterThanOrEqual(beforeTime);
  });

  it('handles ADD_OBJECT deduplication: re-adding existing ID updates object and maintains unique order at the end', () => {
    let state = createInitialCanvasState();
    state = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: sampleRect,
    });

    const secondRect: RectangleObject = {
      ...sampleRect,
      id: 'rect-2',
    };
    state = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: secondRect,
    });

    expect(state.objectOrder).toEqual(['rect-1', 'rect-2']);

    // Re-add rect-1 with modified prop
    const updatedRect1 = { ...sampleRect, width: 300 };
    state = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: updatedRect1,
    });

    expect(state.objectOrder).toEqual(['rect-2', 'rect-1']);
    expect((state.objects['rect-1'] as RectangleObject).width).toBe(300);
  });

  it('handles UPDATE_OBJECT: applies patch, updates object updatedAt, increments version and metadata.updatedAt', () => {
    let state = createInitialCanvasState();
    state = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: sampleRect,
    });

    const nextState = canvasStateReducer(state, {
      type: 'UPDATE_OBJECT',
      payload: { id: 'rect-1', patch: { fill: '#ef4444', width: 250 } },
    });

    const updatedObj = nextState.objects['rect-1'] as RectangleObject;
    expect(updatedObj.fill).toBe('#ef4444');
    expect(updatedObj.width).toBe(250);
    expect(updatedObj.height).toBe(150); // Unmodified remains intact
    expect(nextState.version).toBe(state.version + 1);
    expect(nextState.metadata.updatedAt).toBeGreaterThanOrEqual(state.metadata.updatedAt);
  });

  it('handles UPDATE_OBJECT on non-existent object gracefully (no state change)', () => {
    const state = createInitialCanvasState();
    const nextState = canvasStateReducer(state, {
      type: 'UPDATE_OBJECT',
      payload: { id: 'missing-id', patch: { fill: '#ef4444' } },
    });

    expect(nextState).toBe(state);
    expect(nextState.version).toBe(state.version);
  });

  it('handles MOVE_OBJECT: updates x and y, updates object updatedAt, increments version', () => {
    let state = createInitialCanvasState();
    state = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: sampleRect,
    });

    const nextState = canvasStateReducer(state, {
      type: 'MOVE_OBJECT',
      payload: { id: 'rect-1', x: 350, y: 400 },
    });

    expect(nextState.objects['rect-1'].x).toBe(350);
    expect(nextState.objects['rect-1'].y).toBe(400);
    expect(nextState.version).toBe(state.version + 1);
    expect(nextState.metadata.updatedAt).toBeGreaterThanOrEqual(state.metadata.updatedAt);
  });

  it('handles MOVE_OBJECT on non-existent object gracefully (no state change)', () => {
    const state = createInitialCanvasState();
    const nextState = canvasStateReducer(state, {
      type: 'MOVE_OBJECT',
      payload: { id: 'missing-id', x: 50, y: 50 },
    });

    expect(nextState).toBe(state);
  });

  it('handles DELETE_OBJECT: removes from objects map and objectOrder, increments version', () => {
    let state = createInitialCanvasState();
    state = canvasStateReducer(state, {
      type: 'ADD_OBJECT',
      payload: sampleRect,
    });

    const nextState = canvasStateReducer(state, {
      type: 'DELETE_OBJECT',
      payload: { id: 'rect-1' },
    });

    expect(nextState.objects['rect-1']).toBeUndefined();
    expect(nextState.objectOrder).not.toContain('rect-1');
    expect(nextState.version).toBe(state.version + 1);
  });

  it('handles DELETE_OBJECT on missing object gracefully (no state change)', () => {
    const state = createInitialCanvasState();
    const nextState = canvasStateReducer(state, {
      type: 'DELETE_OBJECT',
      payload: { id: 'missing-id' },
    });

    expect(nextState).toBe(state);
  });

  it('handles SET_STATE: completely replaces canvas state', () => {
    const state = createInitialCanvasState();
    const foreignState: CanvasState = {
      canvasId: 'synced-canvas',
      objects: { 'rect-1': sampleRect },
      objectOrder: ['rect-1'],
      version: 99,
      metadata: {
        name: 'Remote Snapshot',
        backgroundColor: '#1e293b',
        createdAt: 5000,
        updatedAt: 6000,
        ownerId: 'remote-user',
      },
    };

    const nextState = canvasStateReducer(state, {
      type: 'SET_STATE',
      payload: foreignState,
    });

    expect(nextState).toEqual(foreignState);
  });
});
