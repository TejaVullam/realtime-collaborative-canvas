import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyCanvasOperation,
  canvasStateReducer,
  createInitialCanvasState,
} from '../canvasState.js';
import type {
  CanvasOperation,
  CanvasState,
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

  describe('Day 6 — Synchronization Correctness, Conflicts & Idempotency', () => {
    let baseState: CanvasState;

    beforeEach(() => {
      baseState = applyCanvasOperation(initial, {
        operationId: 'op-init-rect',
        canvasId: 'canvas-sync-1',
        type: 'CREATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 100,
        clientId: 'client-0',
        serverSequence: 1,
        serverTimestamp: 1000,
        userId: 'user-0',
        payload: { object: sampleRect },
      });
    });

    it('Case 1: MOVE/MOVE concurrent conflict resolves deterministically via sequence ordering', () => {
      // User A moves object to (100, 100) at server sequence 2
      const opMoveA: CanvasOperation = {
        operationId: 'op-move-a',
        canvasId: 'canvas-sync-1',
        type: 'MOVE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 110,
        clientId: 'client-a',
        serverSequence: 2,
        serverTimestamp: 1010,
        userId: 'user-a',
        payload: { x: 100, y: 100 },
      };

      // User B moves object to (250, 300) at server sequence 3
      const opMoveB: CanvasOperation = {
        operationId: 'op-move-b',
        canvasId: 'canvas-sync-1',
        type: 'MOVE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 112,
        clientId: 'client-b',
        serverSequence: 3,
        serverTimestamp: 1020,
        userId: 'user-b',
        payload: { x: 250, y: 300 },
      };

      // Both clients apply operations in canonical sequence order (2 then 3)
      const stateAfterA = applyCanvasOperation(baseState, opMoveA);
      const finalState = applyCanvasOperation(stateAfterA, opMoveB);

      expect(finalState.objects[sampleRect.id].x).toBe(250);
      expect(finalState.objects[sampleRect.id].y).toBe(300);
    });

    it('Case 2: DELETE/UPDATE conflict — update does NOT resurrect deleted object', () => {
      // User A deletes object at sequence 2
      const opDelete: CanvasOperation = {
        operationId: 'op-del-1',
        canvasId: 'canvas-sync-1',
        type: 'DELETE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 200,
        clientId: 'client-a',
        serverSequence: 2,
        serverTimestamp: 2000,
        userId: 'user-a',
        payload: { objectId: sampleRect.id },
      };

      // User B concurrently sent an update that server orders at sequence 3
      const opUpdate: CanvasOperation = {
        operationId: 'op-upd-after-del',
        canvasId: 'canvas-sync-1',
        type: 'UPDATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 205,
        clientId: 'client-b',
        serverSequence: 3,
        serverTimestamp: 2010,
        userId: 'user-b',
        payload: { patch: { fill: '#ff0000', strokeWidth: 10 } },
      };

      const deletedState = applyCanvasOperation(baseState, opDelete);
      expect(deletedState.objects[sampleRect.id]).toBeUndefined();

      // Applying update to deleted object must be a safe no-op without resurrection
      const finalState = applyCanvasOperation(deletedState, opUpdate);
      expect(finalState.objects[sampleRect.id]).toBeUndefined();
      expect(finalState.objectOrder.includes(sampleRect.id)).toBe(false);
    });

    it('Case 3: DELETE/MOVE conflict — move on deleted object is a safe no-op', () => {
      const opDelete: CanvasOperation = {
        operationId: 'op-del-2',
        canvasId: 'canvas-sync-1',
        type: 'DELETE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 300,
        clientId: 'client-a',
        serverSequence: 2,
        serverTimestamp: 3000,
        userId: 'user-a',
        payload: { objectId: sampleRect.id },
      };

      const opMove: CanvasOperation = {
        operationId: 'op-move-after-del',
        canvasId: 'canvas-sync-1',
        type: 'MOVE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 305,
        clientId: 'client-b',
        serverSequence: 3,
        serverTimestamp: 3010,
        userId: 'user-b',
        payload: { x: 500, y: 600 },
      };

      const deletedState = applyCanvasOperation(baseState, opDelete);
      const finalState = applyCanvasOperation(deletedState, opMove);

      expect(finalState.objects[sampleRect.id]).toBeUndefined();
    });

    it('Case 4: UPDATE/UPDATE conflict — properties merge and later sequence wins', () => {
      // User A updates fill and width at sequence 2
      const opA: CanvasOperation = {
        operationId: 'op-upd-a',
        canvasId: 'canvas-sync-1',
        type: 'UPDATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 400,
        clientId: 'client-a',
        serverSequence: 2,
        serverTimestamp: 4000,
        userId: 'user-a',
        payload: { patch: { fill: '#3b82f6', width: 220 } },
      };

      // User B updates fill and stroke at sequence 3
      const opB: CanvasOperation = {
        operationId: 'op-upd-b',
        canvasId: 'canvas-sync-1',
        type: 'UPDATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 405,
        clientId: 'client-b',
        serverSequence: 3,
        serverTimestamp: 4010,
        userId: 'user-b',
        payload: { patch: { fill: '#10b981', stroke: '#059669' } },
      };

      const stateAfterA = applyCanvasOperation(baseState, opA);
      const finalState = applyCanvasOperation(stateAfterA, opB);

      const obj = finalState.objects[sampleRect.id] as RectangleObject;
      expect(obj.fill).toBe('#10b981'); // Later sequence won
      expect(obj.width).toBe(220); // Merged from opA
      expect(obj.stroke).toBe('#059669'); // From opB
    });

    it('Case 5: UPDATE/DELETE conflict — update applies, then delete removes object cleanly', () => {
      const opUpdate: CanvasOperation = {
        operationId: 'op-upd-first',
        canvasId: 'canvas-sync-1',
        type: 'UPDATE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 500,
        clientId: 'client-a',
        serverSequence: 2,
        serverTimestamp: 5000,
        userId: 'user-a',
        payload: { patch: { strokeWidth: 8 } },
      };

      const opDelete: CanvasOperation = {
        operationId: 'op-del-second',
        canvasId: 'canvas-sync-1',
        type: 'DELETE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 505,
        clientId: 'client-b',
        serverSequence: 3,
        serverTimestamp: 5010,
        userId: 'user-b',
        payload: { objectId: sampleRect.id },
      };

      const stateAfterUpd = applyCanvasOperation(baseState, opUpdate);
      expect((stateAfterUpd.objects[sampleRect.id] as RectangleObject).strokeWidth).toBe(8);

      const finalState = applyCanvasOperation(stateAfterUpd, opDelete);
      expect(finalState.objects[sampleRect.id]).toBeUndefined();
      expect(finalState.objectOrder.includes(sampleRect.id)).toBe(false);
    });

    it('Idempotency: applying the exact same canonical operation multiple times results in identical state', () => {
      const opMove: CanvasOperation = {
        operationId: 'op-idempotent-move',
        canvasId: 'canvas-sync-1',
        type: 'MOVE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 600,
        clientId: 'client-a',
        serverSequence: 2,
        serverTimestamp: 6000,
        userId: 'user-a',
        payload: { x: 42, y: 84 },
      };

      const once = applyCanvasOperation(baseState, opMove);
      const twice = applyCanvasOperation(once, opMove);
      const thrice = applyCanvasOperation(twice, opMove);

      expect(twice.objects).toEqual(once.objects);
      expect(twice.objectOrder).toEqual(once.objectOrder);
      expect(thrice.objects).toEqual(once.objects);
    });

    it('Multi-Client Convergence: 3 independent clients converge to the exact same serialized state', () => {
      // Three distinct operations from 3 clients
      const op1: CanvasOperation = {
        operationId: 'op-conv-1',
        canvasId: 'canvas-sync-1',
        type: 'MOVE_OBJECT',
        objectId: sampleRect.id,
        timestamp: 700,
        clientId: 'client-1',
        serverSequence: 2,
        serverTimestamp: 7000,
        userId: 'user-1',
        payload: { x: 77, y: 88 },
      };

      const rect2: RectangleObject = {
        ...sampleRect,
        id: 'rect-conv-2',
        x: 300,
        y: 400,
      };

      const op2: CanvasOperation = {
        operationId: 'op-conv-2',
        canvasId: 'canvas-sync-1',
        type: 'CREATE_OBJECT',
        objectId: 'rect-conv-2',
        timestamp: 710,
        clientId: 'client-2',
        serverSequence: 3,
        serverTimestamp: 7010,
        userId: 'user-2',
        payload: { object: rect2 },
      };

      const op3: CanvasOperation = {
        operationId: 'op-conv-3',
        canvasId: 'canvas-sync-1',
        type: 'UPDATE_OBJECT',
        objectId: 'rect-conv-2',
        timestamp: 720,
        clientId: 'client-3',
        serverSequence: 4,
        serverTimestamp: 7020,
        userId: 'user-3',
        payload: { patch: { fill: '#f59e0b' } },
      };

      const canonicalLog = [op1, op2, op3];

      // Simulate Client A applying canonical log
      let clientAState = { ...baseState };
      for (const op of canonicalLog) {
        clientAState = applyCanvasOperation(clientAState, op);
      }

      // Simulate Client B applying canonical log
      let clientBState = { ...baseState };
      for (const op of canonicalLog) {
        clientBState = applyCanvasOperation(clientBState, op);
      }

      // Simulate Client C applying canonical log
      let clientCState = { ...baseState };
      for (const op of canonicalLog) {
        clientCState = applyCanvasOperation(clientCState, op);
      }

      // All 3 clients must have deterministic state convergence
      expect(JSON.stringify(clientAState.objects)).toBe(JSON.stringify(clientBState.objects));
      expect(JSON.stringify(clientBState.objects)).toBe(JSON.stringify(clientCState.objects));
      expect(clientAState.objectOrder).toEqual(clientBState.objectOrder);
      expect(clientBState.objectOrder).toEqual(clientCState.objectOrder);
    });
  });
});

