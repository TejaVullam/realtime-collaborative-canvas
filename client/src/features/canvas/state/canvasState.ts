import type {
  CanvasObject,
  CanvasOperation,
  CanvasState,
} from '../../../types/canvas.js';

export type CanvasStateAction =
  | { type: 'ADD_OBJECT'; payload: CanvasObject }
  | { type: 'UPDATE_OBJECT'; payload: { id: string; patch: Partial<CanvasObject> } }
  | { type: 'DELETE_OBJECT'; payload: { id: string } }
  | { type: 'MOVE_OBJECT'; payload: { id: string; x: number; y: number } }
  | { type: 'SET_STATE'; payload: CanvasState }
  | {
      type: 'APPLY_OPERATION';
      source: 'local' | 'remote';
      operation: CanvasOperation;
    };

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

/**
 * Centralized, pure operation application engine for Day 5.
 * Handles both local and remote operations identically, guaranteeing that
 * mutation behavior is deterministic across all collaborating clients.
 */
export function applyCanvasOperation(
  state: CanvasState,
  operation: CanvasOperation,
): CanvasState {
  switch (operation.type) {
    case 'CREATE_OBJECT': {
      const obj = operation.payload.object;
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
      const { patch } = operation.payload;
      const current = state.objects[operation.objectId];
      if (!current) return state; // Safely handle unknown object IDs without throwing

      const updated = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
      } as CanvasObject;

      return {
        ...state,
        objects: {
          ...state.objects,
          [operation.objectId]: updated,
        },
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'MOVE_OBJECT': {
      const { x, y } = operation.payload;
      const current = state.objects[operation.objectId];
      if (!current) return state; // Safely handle unknown object IDs without throwing

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
          [operation.objectId]: updated,
        },
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'DELETE_OBJECT': {
      const objectId = operation.objectId;
      if (!state.objects[objectId]) return state; // Safely handle unknown object IDs

      const nextObjects = { ...state.objects };
      delete nextObjects[objectId];

      return {
        ...state,
        objects: nextObjects,
        objectOrder: state.objectOrder.filter((id) => id !== objectId),
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    case 'REORDER_OBJECT': {
      const { fromIndex, toIndex } = operation.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= state.objectOrder.length ||
        toIndex < 0 ||
        toIndex >= state.objectOrder.length
      ) {
        return state;
      }
      const newOrder = [...state.objectOrder];
      const [movedId] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedId);

      return {
        ...state,
        objectOrder: newOrder,
        version: state.version + 1,
        metadata: {
          ...state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    default:
      return state;
  }
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

    case 'APPLY_OPERATION':
      return applyCanvasOperation(state, action.operation);

    case 'SET_STATE':
      return action.payload;

    default:
      return state;
  }
}
