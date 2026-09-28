import type { CanvasOperation, CanvasOperationType } from '../types/canvas.js';
import type { WebSocketErrorCode } from './types.js';

export interface ValidationSuccess {
  isValid: true;
  operation: CanvasOperation;
}

export interface ValidationFailure {
  isValid: false;
  code: WebSocketErrorCode;
  message: string;
  operationId?: string;
}

export type OperationValidationResult = ValidationSuccess | ValidationFailure;

const ALLOWED_OPERATION_TYPES: CanvasOperationType[] = [
  'CREATE_OBJECT',
  'UPDATE_OBJECT',
  'DELETE_OBJECT',
  'MOVE_OBJECT',
  'REORDER_OBJECT',
];

const ALLOWED_SHAPE_TYPES = [
  'rectangle',
  'ellipse',
  'line',
  'stroke',
  'text',
] as const;

const ALLOWED_MUTABLE_PATCH_FIELDS = new Set([
  'x',
  'y',
  'rotation',
  'scaleX',
  'scaleY',
  'opacity',
  'zIndex',
  'isLocked',
  'width',
  'height',
  'cornerRadius',
  'radiusX',
  'radiusY',
  'points',
  'fill',
  'stroke',
  'strokeWidth',
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'textAlign',
]);

const IMMUTABLE_SYSTEM_FIELDS = new Set([
  'id',
  'type',
  'createdAt',
  'updatedAt',
  'createdBy',
]);

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isPoint(val: unknown): boolean {
  if (!isObject(val)) return false;
  if (!isFiniteNumber(val.x) || !isFiniteNumber(val.y)) return false;
  if (val.pressure !== undefined && !isFiniteNumber(val.pressure)) return false;
  return true;
}

export function validateCanvasOperation(raw: unknown): OperationValidationResult {
  if (!isObject(raw)) {
    return {
      isValid: false,
      code: 'INVALID_OPERATION',
      message: 'Operation payload must be a non-null JSON object',
    };
  }

  const operationId = raw.operationId;
  const rawOpIdStr = typeof operationId === 'string' && operationId.trim() !== '' ? operationId.trim() : undefined;

  if (!rawOpIdStr) {
    return {
      isValid: false,
      code: 'INVALID_OPERATION',
      message: 'Missing or empty required field: operationId',
    };
  }

  const type = raw.type;
  if (typeof type !== 'string' || !ALLOWED_OPERATION_TYPES.includes(type as CanvasOperationType)) {
    return {
      isValid: false,
      code: 'INVALID_OPERATION_TYPE',
      message: `Invalid operation type: "${String(type)}"`,
      operationId: rawOpIdStr,
    };
  }

  const objectId = raw.objectId;
  if (typeof objectId !== 'string' || objectId.trim() === '') {
    return {
      isValid: false,
      code: 'INVALID_OPERATION',
      message: 'Missing or empty required field: objectId',
      operationId: rawOpIdStr,
    };
  }

  const clientId = raw.clientId;
  if (typeof clientId !== 'string' || clientId.trim() === '') {
    return {
      isValid: false,
      code: 'INVALID_OPERATION',
      message: 'Missing or empty required field: clientId',
      operationId: rawOpIdStr,
    };
  }

  const timestamp = raw.timestamp;
  if (!isFiniteNumber(timestamp) || timestamp <= 0) {
    return {
      isValid: false,
      code: 'INVALID_OPERATION',
      message: 'Field timestamp must be a positive finite number',
      operationId: rawOpIdStr,
    };
  }

  const payload = raw.payload;
  if (!isObject(payload)) {
    return {
      isValid: false,
      code: 'INVALID_OPERATION_PAYLOAD',
      message: 'Operation payload must be an object',
      operationId: rawOpIdStr,
    };
  }

  // Per-type payload validation
  switch (type as CanvasOperationType) {
    case 'CREATE_OBJECT': {
      const obj = payload.object;
      if (!isObject(obj)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'CREATE_OBJECT payload must contain an "object" object',
          operationId: rawOpIdStr,
        };
      }

      if (typeof obj.id !== 'string' || obj.id !== objectId || obj.id.trim() === '') {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object id in payload must match operation objectId and be non-empty',
          operationId: rawOpIdStr,
        };
      }

      if (typeof obj.type !== 'string' || !ALLOWED_SHAPE_TYPES.includes(obj.type as (typeof ALLOWED_SHAPE_TYPES)[number])) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: `Object type must be one of: ${ALLOWED_SHAPE_TYPES.join(', ')}`,
          operationId: rawOpIdStr,
        };
      }

      // Base CanvasObject attributes validation
      if (!isFiniteNumber(obj.x) || !isFiniteNumber(obj.y)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object coordinates x and y must be finite numbers',
          operationId: rawOpIdStr,
        };
      }

      if (!isFiniteNumber(obj.rotation)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object rotation must be a finite number',
          operationId: rawOpIdStr,
        };
      }

      if (!isFiniteNumber(obj.scaleX) || !isFiniteNumber(obj.scaleY)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object scaleX and scaleY must be finite numbers',
          operationId: rawOpIdStr,
        };
      }

      if (!isFiniteNumber(obj.opacity) || obj.opacity < 0 || obj.opacity > 1) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object opacity must be a finite number between 0 and 1',
          operationId: rawOpIdStr,
        };
      }

      if (!isFiniteNumber(obj.zIndex)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object zIndex must be a finite number',
          operationId: rawOpIdStr,
        };
      }

      if (!isFiniteNumber(obj.createdAt) || obj.createdAt <= 0) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object createdAt must be a positive timestamp',
          operationId: rawOpIdStr,
        };
      }

      if (!isFiniteNumber(obj.updatedAt) || obj.updatedAt <= 0) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object updatedAt must be a positive timestamp',
          operationId: rawOpIdStr,
        };
      }

      if (obj.isLocked !== undefined && typeof obj.isLocked !== 'boolean') {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object isLocked must be a boolean when present',
          operationId: rawOpIdStr,
        };
      }

      if (obj.createdBy !== undefined && (typeof obj.createdBy !== 'string' || obj.createdBy.trim() === '')) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object createdBy must be a non-empty string when present',
          operationId: rawOpIdStr,
        };
      }

      // Discriminated shape-specific validation
      if (obj.type === 'rectangle') {
        if (!isFiniteNumber(obj.width) || !isFiniteNumber(obj.height) || obj.width < 0 || obj.height < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Rectangle object must have non-negative finite width and height',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.fill !== 'string' || typeof obj.stroke !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Rectangle object must have string fill and stroke colors',
            operationId: rawOpIdStr,
          };
        }
        if (!isFiniteNumber(obj.strokeWidth) || obj.strokeWidth < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Rectangle strokeWidth must be a non-negative finite number',
            operationId: rawOpIdStr,
          };
        }
        if (obj.cornerRadius !== undefined && (!isFiniteNumber(obj.cornerRadius) || obj.cornerRadius < 0)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Rectangle cornerRadius must be a non-negative finite number when present',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'ellipse') {
        if (!isFiniteNumber(obj.radiusX) || !isFiniteNumber(obj.radiusY) || obj.radiusX < 0 || obj.radiusY < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Ellipse object must have non-negative finite radiusX and radiusY',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.fill !== 'string' || typeof obj.stroke !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Ellipse object must have string fill and stroke colors',
            operationId: rawOpIdStr,
          };
        }
        if (!isFiniteNumber(obj.strokeWidth) || obj.strokeWidth < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Ellipse strokeWidth must be a non-negative finite number',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'line') {
        if (!Array.isArray(obj.points) || obj.points.length !== 2 || !obj.points.every(isPoint)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Line object must have exactly 2 valid points with finite x and y coordinates',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.stroke !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Line object must have a string stroke color',
            operationId: rawOpIdStr,
          };
        }
        if (!isFiniteNumber(obj.strokeWidth) || obj.strokeWidth < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Line strokeWidth must be a non-negative finite number',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'stroke') {
        if (!Array.isArray(obj.points) || obj.points.length < 1 || !obj.points.every(isPoint)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Stroke object must have at least 1 valid point with finite x and y coordinates',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.stroke !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Stroke object must have a string stroke color',
            operationId: rawOpIdStr,
          };
        }
        if (!isFiniteNumber(obj.strokeWidth) || obj.strokeWidth < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Stroke strokeWidth must be a non-negative finite number',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'text') {
        if (typeof obj.text !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text object must have a string text field',
            operationId: rawOpIdStr,
          };
        }
        if (!isFiniteNumber(obj.fontSize) || obj.fontSize <= 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text fontSize must be a positive finite number',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.fontFamily !== 'string' || obj.fontFamily.trim() === '') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text fontFamily must be a non-empty string',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.fontWeight !== 'string' && typeof obj.fontWeight !== 'number') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text fontWeight must be a string or number',
            operationId: rawOpIdStr,
          };
        }
        if (typeof obj.fill !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text fill must be a string color',
            operationId: rawOpIdStr,
          };
        }
        if (obj.textAlign !== 'left' && obj.textAlign !== 'center' && obj.textAlign !== 'right') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text textAlign must be "left", "center", or "right"',
            operationId: rawOpIdStr,
          };
        }
        if (obj.width !== undefined && (!isFiniteNumber(obj.width) || obj.width < 0)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text width must be a non-negative finite number when present',
            operationId: rawOpIdStr,
          };
        }
        if (obj.height !== undefined && (!isFiniteNumber(obj.height) || obj.height < 0)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Text height must be a non-negative finite number when present',
            operationId: rawOpIdStr,
          };
        }
      }
      break;
    }

    case 'UPDATE_OBJECT': {
      const patch = payload.patch;
      if (!isObject(patch)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'UPDATE_OBJECT payload must contain a "patch" object',
          operationId: rawOpIdStr,
        };
      }

      const patchKeys = Object.keys(patch);
      if (patchKeys.length === 0) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'UPDATE_OBJECT patch must contain at least one property to update',
          operationId: rawOpIdStr,
        };
      }

      for (const key of patchKeys) {
        if (IMMUTABLE_SYSTEM_FIELDS.has(key)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: `Modifying immutable system field "${key}" is prohibited`,
            operationId: rawOpIdStr,
          };
        }

        if (!ALLOWED_MUTABLE_PATCH_FIELDS.has(key)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: `Unknown or disallowed patch property: "${key}"`,
            operationId: rawOpIdStr,
          };
        }

        const val = patch[key];

        // Specific property type validation
        if ((key === 'x' || key === 'y' || key === 'rotation' || key === 'scaleX' || key === 'scaleY' || key === 'zIndex') && !isFiniteNumber(val)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: `Patch field "${key}" must be a finite number`,
            operationId: rawOpIdStr,
          };
        }

        if (key === 'opacity' && (!isFiniteNumber(val) || val < 0 || val > 1)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "opacity" must be a finite number between 0 and 1',
            operationId: rawOpIdStr,
          };
        }

        if (key === 'isLocked' && typeof val !== 'boolean') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "isLocked" must be a boolean',
            operationId: rawOpIdStr,
          };
        }

        if ((key === 'width' || key === 'height' || key === 'radiusX' || key === 'radiusY' || key === 'strokeWidth' || key === 'cornerRadius') && (!isFiniteNumber(val) || val < 0)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: `Patch field "${key}" must be a non-negative finite number`,
            operationId: rawOpIdStr,
          };
        }

        if ((key === 'fill' || key === 'stroke' || key === 'text') && typeof val !== 'string') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: `Patch field "${key}" must be a string`,
            operationId: rawOpIdStr,
          };
        }

        if (key === 'fontSize' && (!isFiniteNumber(val) || val <= 0)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "fontSize" must be a positive finite number',
            operationId: rawOpIdStr,
          };
        }

        if (key === 'fontFamily' && (typeof val !== 'string' || val.trim() === '')) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "fontFamily" must be a non-empty string',
            operationId: rawOpIdStr,
          };
        }

        if (key === 'fontWeight' && typeof val !== 'string' && typeof val !== 'number') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "fontWeight" must be a string or number',
            operationId: rawOpIdStr,
          };
        }

        if (key === 'textAlign' && val !== 'left' && val !== 'center' && val !== 'right') {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "textAlign" must be "left", "center", or "right"',
            operationId: rawOpIdStr,
          };
        }

        if (key === 'points' && (!Array.isArray(val) || val.length === 0 || !val.every(isPoint))) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Patch field "points" must be a non-empty array of valid Points',
            operationId: rawOpIdStr,
          };
        }
      }

      break;
    }

    case 'DELETE_OBJECT': {
      const targetObjectId = payload.objectId;
      if (typeof targetObjectId !== 'string' || targetObjectId !== objectId) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'DELETE_OBJECT payload objectId must match operation objectId',
          operationId: rawOpIdStr,
        };
      }
      break;
    }

    case 'MOVE_OBJECT': {
      if (!isFiniteNumber(payload.x) || !isFiniteNumber(payload.y)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'MOVE_OBJECT payload must contain finite x and y coordinates',
          operationId: rawOpIdStr,
        };
      }
      break;
    }

    case 'REORDER_OBJECT': {
      if (
        !Number.isInteger(payload.fromIndex) ||
        (payload.fromIndex as number) < 0 ||
        !Number.isInteger(payload.toIndex) ||
        (payload.toIndex as number) < 0
      ) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'REORDER_OBJECT payload must contain non-negative integer fromIndex and toIndex',
          operationId: rawOpIdStr,
        };
      }
      break;
    }
  }

  return {
    isValid: true,
    operation: raw as unknown as CanvasOperation,
  };
}
