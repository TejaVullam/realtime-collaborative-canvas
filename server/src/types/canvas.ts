/**
 * Canvas Domain Model
 *
 * Defines the core domain entities, object representations, state structure,
 * and operation models for the Real-Time Collaborative Canvas server.
 */

// ============================================================================
// 1. Primitive Geometric Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

// ============================================================================
// 2. Base Canvas Object
// ============================================================================

export interface BaseCanvasObject {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
  isLocked?: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

// ============================================================================
// 3. Concrete Object Types (Discriminated Union)
// ============================================================================

export interface RectangleObject extends BaseCanvasObject {
  type: 'rectangle';
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
}

export interface EllipseObject extends BaseCanvasObject {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface LineObject extends BaseCanvasObject {
  type: 'line';
  points: [Point, Point];
  stroke: string;
  strokeWidth: number;
}

export interface StrokeObject extends BaseCanvasObject {
  type: 'stroke';
  points: Point[];
  stroke: string;
  strokeWidth: number;
}

export interface TextObject extends BaseCanvasObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string | number;
  fill: string;
  textAlign: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
}

export type CanvasObject =
  | RectangleObject
  | EllipseObject
  | LineObject
  | StrokeObject
  | TextObject;

export type CanvasObjectType = CanvasObject['type'];

// ============================================================================
// 4. Canvas State Container
// ============================================================================

export interface CanvasMetadata {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
}

export interface CanvasState {
  canvasId: string;
  objects: Record<string, CanvasObject>;
  objectOrder: string[];
  version: number;
  metadata: CanvasMetadata;
}

// ============================================================================
// 5. Canvas Operation Model (for Real-Time Synchronization & Replay)
// ============================================================================

export type CanvasOperationType =
  | 'CREATE_OBJECT'
  | 'UPDATE_OBJECT'
  | 'DELETE_OBJECT'
  | 'MOVE_OBJECT'
  | 'REORDER_OBJECT';

export interface BaseOperation {
  operationId: string;
  canvasId: string;
  type: CanvasOperationType;
  objectId: string;
  timestamp: number;
  clientId: string;
  sequenceNumber?: number;
}

export interface CreateObjectOperation extends BaseOperation {
  type: 'CREATE_OBJECT';
  payload: {
    object: CanvasObject;
  };
}

export interface UpdateObjectOperation extends BaseOperation {
  type: 'UPDATE_OBJECT';
  payload: {
    patch: Partial<Omit<CanvasObject, 'id' | 'type' | 'createdAt' | 'createdBy'>>;
  };
}

export interface DeleteObjectOperation extends BaseOperation {
  type: 'DELETE_OBJECT';
  payload: {
    objectId: string;
  };
}

export interface MoveObjectOperation extends BaseOperation {
  type: 'MOVE_OBJECT';
  payload: {
    x: number;
    y: number;
  };
}

export interface ReorderObjectOperation extends BaseOperation {
  type: 'REORDER_OBJECT';
  payload: {
    fromIndex: number;
    toIndex: number;
    newZIndex?: number;
  };
}

export type CanvasOperation =
  | CreateObjectOperation
  | UpdateObjectOperation
  | DeleteObjectOperation
  | MoveObjectOperation
  | ReorderObjectOperation;
