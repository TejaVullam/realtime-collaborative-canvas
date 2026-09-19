import type { CanvasObject, CanvasState } from '../../../types/canvas.js';

export type CanvasStateAction =
  | { type: 'ADD_OBJECT'; payload: CanvasObject }
  | { type: 'UPDATE_OBJECT'; payload: { id: string; patch: Partial<CanvasObject> } }
  | { type: 'DELETE_OBJECT'; payload: { id: string } }
  | { type: 'MOVE_OBJECT'; payload: { id: string; x: number; y: number } }
  | { type: 'SET_STATE'; payload: CanvasState };

export function createInitialCanvasState(canvasId = 'local-canvas-1'): CanvasState {
  return {
    canvasId,
    objects: {},
    objectOrder: [],
    version: 1,
    metadata: {
      name: 'Untitled Workspace',
      backgroundColor: '#090d16',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ownerId: 'local-user',
    },
  };
}

export function canvasStateReducer(state: CanvasState, action: CanvasStateAction): CanvasState {
  switch (action.type) {
    case 'ADD_OBJECT': {
      const obj = action.payload;
      return {
        ...state,
        objects: {
          ...state.objects,
          [obj.id]: obj,
        },
        objectOrder: [...state.objectOrder.filter((id) => id !== obj.id), obj.id],
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'UPDATE_OBJECT': {
      const { id, patch } = action.payload;
      const current = state.objects[id];
      if (!current) return state;

      const updated = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
      } as CanvasObject;

      return {
        ...state,
        objects: {
          ...state.objects,
          [id]: updated,
        },
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'MOVE_OBJECT': {
      const { id, x, y } = action.payload;
      const current = state.objects[id];
      if (!current) return state;

      const updated = {
        ...current,
        x,
        y,
        updatedAt: Date.now(),
      } as CanvasObject;

      return {
        ...state,
        objects: {
          ...state.objects,
          [id]: updated,
        },
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'DELETE_OBJECT': {
      const { id } = action.payload;
      if (!state.objects[id]) return state;

      const nextObjects = { ...state.objects };
      delete nextObjects[id];

      return {
        ...state,
        objects: nextObjects,
        objectOrder: state.objectOrder.filter((objId) => objId !== id),
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'SET_STATE':
      return action.payload;

    default:
      return state;
  }
}
