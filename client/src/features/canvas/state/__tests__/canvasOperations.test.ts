import { describe, it, expect } from 'vitest';
import {
  applyCanvasOperation,
  canvasStateReducer,
  createInitialCanvasState,
} from '../canvasState.js';
import type {
  CanvasOperation,
  EllipseObject,
  LineObject,
  RectangleObject,
  StrokeObject,
  TextObject,
} from '../../../../types/canvas.js';

describe('Canvas Operation Application & Reducer Integration Suite (Day 5)', () => {
  const initial = createInitialCanvasState('canvas-test-1');

  const sampleRect: RectangleObject = {
    id: 'rect-1',
    type: 'rectangle',
    x: 20,
    y: 30,
    width: 100,
    height: 80,
    fill: '#38bdf822',
    stroke: '#38bdf8',
    strokeWidth: 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 0,
    createdAt: 1000,
    updatedAt: 1000,
    createdBy: 'user-a',
  };

  const sampleEllipse: EllipseObject = {
    id: 'ellipse-1',
    type: 'ellipse',
    x: 200,
    y: 200,
    radiusX: 40,
    radiusY: 30,
    fill: '#10b98122',
    stroke: '#10b981',
    strokeWidth: 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 1,
    createdAt: 1000,
    updatedAt: 1000,
    createdBy: 'user-a',
  };

  const sampleLine: LineObject = {
    id: 'line-1',
    type: 'line',
    x: 10,
    y: 10,
    points: [
      { x: 10, y: 10 },
      { x: 100, y: 100 },
    ],
    stroke: '#f59e0b',
    strokeWidth: 3,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 2,
    createdAt: 1000,
    updatedAt: 1000,
    createdBy: 'user-a',
  };

  const sampleStroke: StrokeObject = {
    id: 'stroke-1',
    type: 'stroke',
    x: 5,
    y: 5,
    points: [
      { x: 5, y: 5 },
      { x: 15, y: 25 },
      { x: 30, y: 40 },
    ],
    stroke: '#ec4899',
    strokeWidth: 4,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 3,
    createdAt: 1000,
    updatedAt: 1000,
    createdBy: 'user-a',
  };

  const sampleText: TextObject = {
    id: 'text-1',
    type: 'text',
    x: 50,
    y: 50,
    text: 'Hello Collaboration',
    fontSize: 24,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 'normal',
    textAlign: 'left',
    fill: '#ffffff',
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    zIndex: 4,
    createdAt: 1000,
    updatedAt: 1000,
    createdBy: 'user-a',
  };

  describe('applyCanvasOperation - CREATE_OBJECT', () => {
    it('should create rectangle, ellipse, line, stroke, and text objects', () => {
      let state = initial;

      const objects = [sampleRect, sampleEllipse, sampleLine, sampleStroke, sampleText];
      for (const obj of objects) {
        const op: CanvasOperation = {
          operationId: `op-create-${obj.id}`,
          canvasId: 'canvas-test-1',
          type: 'CREATE_OBJECT',
          objectId: obj.id,
          timestamp: 2000,
          clientId: 'client-1',
          payload: { object: obj },
        };
        state = applyCanvasOperation(state, op);
      }

      expect(state.objectOrder).toEqual(['rect-1', 'ellipse-1', 'line-1', 'stroke-1', 'text-1']);
      expect(state.objects['rect-1']).toEqual(sampleRect);
      expect(state.objects['ellipse-1']).toEqual(sampleEllipse);
      expect(state.objects['line-1']).toEqual(sampleLine);
      expect(state.objects['stroke-1']).toEqual(sampleStroke);
      expect(state.objects['text-1']).toEqual(sampleText);
      expect(state.version).toBe(6); // 1 initial + 5 additions
    });
  });

  describe('applyCanvasOperation - UPDATE_OBJECT & MOVE_OBJECT', () => {
    it('should update object properties', () => {
      const stateWithRect = applyCanvasOperation(initial, {
        operationId: 'op-1',
        canvasId: 'canvas-test-1',
        type: 'CREATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 1000,
        clientId: 'client-1',
        payload: { object: sampleRect },
      });

      const updateOp: CanvasOperation = {
        operationId: 'op-2',
        canvasId: 'canvas-test-1',
        type: 'UPDATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 2000,
        clientId: 'client-2',
        payload: { patch: { fill: '#ef4444', width: 250 } },
      };

      const updated = applyCanvasOperation(stateWithRect, updateOp);
      const rect = updated.objects[sampleRect.id] as RectangleObject;
      expect(rect.fill).toBe('#ef4444');
      expect(rect.width).toBe(250);
      expect(rect.height).toBe(sampleRect.height);
      expect(updated.version).toBe(3);
    });

    it('should move object coordinates with MOVE_OBJECT', () => {
      const stateWithRect = applyCanvasOperation(initial, {
        operationId: 'op-1',
        canvasId: 'canvas-test-1',
        type: 'CREATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 1000,
        clientId: 'client-1',
        payload: { object: sampleRect },
      });

      const moveOp: CanvasOperation = {
        operationId: 'op-move-1',
        canvasId: 'canvas-test-1',
        type: 'MOVE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 2500,
        clientId: 'client-2',
        payload: { x: 450, y: 600 },
      };

      const moved = applyCanvasOperation(stateWithRect, moveOp);
      expect(moved.objects[sampleRect.id].x).toBe(450);
      expect(moved.objects[sampleRect.id].y).toBe(600);
      expect(moved.version).toBe(3);
    });

    it('should safely ignore updates and moves for unknown objectIds without throwing', () => {
      const updateUnknown: CanvasOperation = {
        operationId: 'op-unk-1',
        canvasId: 'canvas-test-1',
        type: 'UPDATE_OBJECT',
        objectId: 'ghost-object-99',
        timestamp: 3000,
        clientId: 'client-x',
        payload: { patch: { x: 999 } },
      };

      const stateAfterUpdate = applyCanvasOperation(initial, updateUnknown);
      expect(stateAfterUpdate).toBe(initial);

      const moveUnknown: CanvasOperation = {
        operationId: 'op-unk-2',
        canvasId: 'canvas-test-1',
        type: 'MOVE_OBJECT',
        objectId: 'ghost-object-99',
        timestamp: 3100,
        clientId: 'client-x',
        payload: { x: 50, y: 50 },
      };

      const stateAfterMove = applyCanvasOperation(initial, moveUnknown);
      expect(stateAfterMove).toBe(initial);
    });
  });

  describe('applyCanvasOperation - DELETE_OBJECT', () => {
    it('should remove object from objects dictionary and objectOrder', () => {
      const stateWithRect = applyCanvasOperation(initial, {
        operationId: 'op-1',
        canvasId: 'canvas-test-1',
        type: 'CREATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 1000,
        clientId: 'client-1',
        payload: { object: sampleRect },
      });

      const deleteOp: CanvasOperation = {
        operationId: 'op-del-1',
        canvasId: 'canvas-test-1',
        type: 'DELETE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 3500,
        clientId: 'client-1',
        payload: { objectId: sampleRect.id },
      };

      const stateAfterDelete = applyCanvasOperation(stateWithRect, deleteOp);
      expect(stateAfterDelete.objects[sampleRect.id]).toBeUndefined();
      expect(stateAfterDelete.objectOrder).not.toContain(sampleRect.id);
      expect(stateAfterDelete.version).toBe(3);
    });

    it('should safely ignore deleting an unknown objectId', () => {
      const deleteUnknown: CanvasOperation = {
        operationId: 'op-del-ghost',
        canvasId: 'canvas-test-1',
        type: 'DELETE_OBJECT',
        objectId: 'ghost-object-99',
        timestamp: 4000,
        clientId: 'client-1',
        payload: { objectId: 'ghost-object-99' },
      };

      const result = applyCanvasOperation(initial, deleteUnknown);
      expect(result).toBe(initial);
    });
  });

  describe('applyCanvasOperation - REORDER_OBJECT', () => {
    it('should reorder objects safely in objectOrder', () => {
      let state = initial;
      state = applyCanvasOperation(state, {
        operationId: 'op-1',
        canvasId: 'c1',
        type: 'CREATE_OBJECT',
        objectId: 'obj-a',
        timestamp: 1,
        clientId: 'c',
        payload: { object: { ...sampleRect, id: 'obj-a' } },
      });
      state = applyCanvasOperation(state, {
        operationId: 'op-2',
        canvasId: 'c1',
        type: 'CREATE_OBJECT',
        objectId: 'obj-b',
        timestamp: 2,
        clientId: 'c',
        payload: { object: { ...sampleRect, id: 'obj-b' } },
      });
      state = applyCanvasOperation(state, {
        operationId: 'op-3',
        canvasId: 'c1',
        type: 'CREATE_OBJECT',
        objectId: 'obj-c',
        timestamp: 3,
        clientId: 'c',
        payload: { object: { ...sampleRect, id: 'obj-c' } },
      });

      expect(state.objectOrder).toEqual(['obj-a', 'obj-b', 'obj-c']);

      // Move obj-a (index 0) to index 2
      const reorderOp: CanvasOperation = {
        operationId: 'op-reorder-1',
        canvasId: 'c1',
        type: 'REORDER_OBJECT',
        objectId: 'obj-a',
        timestamp: 4,
        clientId: 'c',
        payload: { fromIndex: 0, toIndex: 2 },
      };

      const reordered = applyCanvasOperation(state, reorderOp);
      expect(reordered.objectOrder).toEqual(['obj-b', 'obj-c', 'obj-a']);
    });
  });

  describe('canvasStateReducer - APPLY_OPERATION Action (Local & Remote)', () => {
    it('should process APPLY_OPERATION with source: "local" and source: "remote" identically', () => {
      const op: CanvasOperation = {
        operationId: 'op-local-1',
        canvasId: 'c1',
        type: 'CREATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 100,
        clientId: 'client-1',
        payload: { object: sampleRect },
      };

      const localResult = canvasStateReducer(initial, {
        type: 'APPLY_OPERATION',
        source: 'local',
        operation: op,
      });

      const remoteResult = canvasStateReducer(initial, {
        type: 'APPLY_OPERATION',
        source: 'remote',
        operation: op,
      });

      expect(localResult.objects).toEqual(remoteResult.objects);
      expect(localResult.objectOrder).toEqual(remoteResult.objectOrder);
      expect(localResult.version).toEqual(remoteResult.version);
    });
  });
});
