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

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isPoint(val: unknown): boolean {
  if (!isObject(val)) return false;
  return isFiniteNumber(val.x) && isFiniteNumber(val.y);
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

      if (typeof obj.id !== 'string' || obj.id !== objectId) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object id in payload must match operation objectId',
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

      if (!isFiniteNumber(obj.x) || !isFiniteNumber(obj.y)) {
        return {
          isValid: false,
          code: 'INVALID_OPERATION_PAYLOAD',
          message: 'Object coordinates x and y must be finite numbers',
          operationId: rawOpIdStr,
        };
      }

      if (obj.type === 'rectangle') {
        if (!isFiniteNumber(obj.width) || !isFiniteNumber(obj.height) || obj.width < 0 || obj.height < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Rectangle object must have non-negative width and height',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'ellipse') {
        if (!isFiniteNumber(obj.radiusX) || !isFiniteNumber(obj.radiusY) || obj.radiusX < 0 || obj.radiusY < 0) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Ellipse object must have non-negative radiusX and radiusY',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'line') {
        if (!Array.isArray(obj.points) || obj.points.length < 2 || !obj.points.every(isPoint)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Line object must have at least 2 valid points with x and y coordinates',
            operationId: rawOpIdStr,
          };
        }
      } else if (obj.type === 'stroke') {
        if (!Array.isArray(obj.points) || obj.points.length < 1 || !obj.points.every(isPoint)) {
          return {
            isValid: false,
            code: 'INVALID_OPERATION_PAYLOAD',
            message: 'Stroke object must have at least 1 valid point with x and y coordinates',
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
