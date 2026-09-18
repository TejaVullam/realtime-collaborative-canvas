import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  CanvasObject,
  CanvasState,
  EllipseObject,
  LineObject,
  Point,
  RectangleObject,
  StrokeObject,
  TextObject,
} from '../../../types/canvas.js';
import type { CanvasTool, CanvasViewport, ResizeHandle } from '../types/interaction.js';
import { screenToWorld, zoomAtScreenPoint } from '../utils/coordinates.js';
import { getObjectBounds, normalizeBox } from '../utils/geometry.js';
import { findTopObjectAtPoint, hitTestResizeHandle } from '../utils/hitTesting.js';

interface UseCanvasInteractionProps {
  canvasState: CanvasState;
  onAddObject: (obj: CanvasObject) => void;
  onUpdateObject: (id: string, patch: Partial<CanvasObject>) => void;
  onDeleteObject: (id: string) => void;
}

export interface TextInputState {
  isOpen: boolean;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  text: string;
}

export function useCanvasInteraction({
  canvasState,
  onAddObject,
  onUpdateObject,
  onDeleteObject,
}: UseCanvasInteractionProps) {
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 0, y: 0, zoom: 1 });
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [previewObject, setPreviewObject] = useState<CanvasObject | null>(null);
  const [textInputState, setTextInputState] = useState<TextInputState | null>(null);

  const isPointerDownRef = useRef(false);
  const isSpacePressedRef = useRef(false);
  const pointerStartScreenRef = useRef<Point>({ x: 0, y: 0 });
  const pointerStartWorldRef = useRef<Point>({ x: 0, y: 0 });
  const viewportStartRef = useRef<CanvasViewport>({ x: 0, y: 0, zoom: 1 });
  const activeResizeHandleRef = useRef<ResizeHandle | null>(null);
  const initialObjectBoundsRef = useRef<ReturnType<typeof getObjectBounds> | null>(null);
  const initialObjectPosRef = useRef<Point | null>(null);
  const activeStrokePointsRef = useRef<Point[]>([]);

  const generateId = useCallback((prefix: string) => {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          onDeleteObject(selectedObjectId);
          setSelectedObjectId(null);
        }
      }

      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      else if (key === 'r') setActiveTool('rectangle');
      else if (key === 'o') setActiveTool('ellipse');
      else if (key === 'l') setActiveTool('line');
      else if (key === 'p') setActiveTool('pencil');
      else if (key === 't') setActiveTool('text');
      else if (key === 'h') setActiveTool('pan');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedObjectId, onDeleteObject]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY, viewport);

      isPointerDownRef.current = true;
      pointerStartScreenRef.current = { x: screenX, y: screenY };
      pointerStartWorldRef.current = worldPoint;
      viewportStartRef.current = { ...viewport };

      if (isSpacePressedRef.current || activeTool === 'pan' || e.button === 1) {
        return;
      }

      if (activeTool === 'select') {
        if (selectedObjectId && canvasState.objects[selectedObjectId]) {
          const selectedObj = canvasState.objects[selectedObjectId];
          const bounds = getObjectBounds(selectedObj);
          const handleSize = 10 / viewport.zoom;
          const clickedHandle = hitTestResizeHandle(worldPoint, bounds, handleSize);

          if (clickedHandle) {
            activeResizeHandleRef.current = clickedHandle;
            initialObjectBoundsRef.current = bounds;
            return;
          }
        }

        const hitObj = findTopObjectAtPoint(worldPoint, canvasState.objectOrder, canvasState.objects);
        if (hitObj) {
          setSelectedObjectId(hitObj.id);
          initialObjectPosRef.current = { x: hitObj.x, y: hitObj.y };
        } else {
          setSelectedObjectId(null);
          initialObjectPosRef.current = null;
        }
        return;
      }

      if (activeTool === 'pencil') {
        activeStrokePointsRef.current = [worldPoint];
        const newStroke: StrokeObject = {
          id: generateId('stroke'),
          type: 'stroke',
          x: worldPoint.x,
          y: worldPoint.y,
          points: [worldPoint],
          stroke: selectedColor,
          strokeWidth,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          zIndex: canvasState.objectOrder.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'local-user',
        };
        setPreviewObject(newStroke);
      } else if (activeTool === 'text') {
        setTextInputState({
          isOpen: true,
          screenX,
          screenY,
          worldX: worldPoint.x,
          worldY: worldPoint.y,
          text: '',
        });
      }
    },
    [viewport, activeTool, selectedObjectId, canvasState, selectedColor, strokeWidth, generateId],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isPointerDownRef.current) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY, viewport);

      if (isSpacePressedRef.current || activeTool === 'pan' || e.buttons === 4) {
        const dx = screenX - pointerStartScreenRef.current.x;
        const dy = screenY - pointerStartScreenRef.current.y;
        setViewport({
          ...viewportStartRef.current,
          x: viewportStartRef.current.x + dx,
          y: viewportStartRef.current.y + dy,
        });
        return;
      }

      if (activeTool === 'select') {
        if (activeResizeHandleRef.current && selectedObjectId && initialObjectBoundsRef.current) {
          const handle = activeResizeHandleRef.current;
          const initialBounds = initialObjectBoundsRef.current;
          const currentObj = canvasState.objects[selectedObjectId];
          if (!currentObj) return;

          let newX = initialBounds.minX;
          let newY = initialBounds.minY;
          let newWidth = initialBounds.width;
          let newHeight = initialBounds.height;

          const dx = worldPoint.x - pointerStartWorldRef.current.x;
          const dy = worldPoint.y - pointerStartWorldRef.current.y;

          if (handle === 'se') {
            newWidth = Math.max(10, initialBounds.width + dx);
            newHeight = Math.max(10, initialBounds.height + dy);
          } else if (handle === 'sw') {
            const rawWidth = initialBounds.width - dx;
            if (rawWidth > 10) {
              newX = initialBounds.minX + dx;
              newWidth = rawWidth;
            }
            newHeight = Math.max(10, initialBounds.height + dy);
          } else if (handle === 'ne') {
            newWidth = Math.max(10, initialBounds.width + dx);
            const rawHeight = initialBounds.height - dy;
            if (rawHeight > 10) {
              newY = initialBounds.minY + dy;
              newHeight = rawHeight;
            }
          } else if (handle === 'nw') {
            const rawWidth = initialBounds.width - dx;
            const rawHeight = initialBounds.height - dy;
            if (rawWidth > 10) {
              newX = initialBounds.minX + dx;
              newWidth = rawWidth;
            }
            if (rawHeight > 10) {
              newY = initialBounds.minY + dy;
              newHeight = rawHeight;
            }
          }

          if (currentObj.type === 'rectangle') {
            onUpdateObject(selectedObjectId, {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            });
          } else if (currentObj.type === 'ellipse') {
            onUpdateObject(selectedObjectId, {
              x: newX + newWidth / 2,
              y: newY + newHeight / 2,
              radiusX: newWidth / 2,
              radiusY: newHeight / 2,
            });
          }
          return;
        }

        if (selectedObjectId && initialObjectPosRef.current) {
          const dx = worldPoint.x - pointerStartWorldRef.current.x;
          const dy = worldPoint.y - pointerStartWorldRef.current.y;
          onUpdateObject(selectedObjectId, {
            x: initialObjectPosRef.current.x + dx,
            y: initialObjectPosRef.current.y + dy,
          });
          return;
        }
      }

      if (activeTool === 'rectangle') {
        const box = normalizeBox(pointerStartWorldRef.current, worldPoint);
        const rectObj: RectangleObject = {
          id: 'preview-rect',
          type: 'rectangle',
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          fill: `${selectedColor}22`,
          stroke: selectedColor,
          strokeWidth,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.9,
          zIndex: canvasState.objectOrder.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'local-user',
        };
        setPreviewObject(rectObj);
      } else if (activeTool === 'ellipse') {
        const box = normalizeBox(pointerStartWorldRef.current, worldPoint);
        const rx = box.width / 2;
        const ry = box.height / 2;
        const ellipseObj: EllipseObject = {
          id: 'preview-ellipse',
          type: 'ellipse',
          x: box.x + rx,
          y: box.y + ry,
          radiusX: rx,
          radiusY: ry,
          fill: `${selectedColor}22`,
          stroke: selectedColor,
          strokeWidth,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.9,
          zIndex: canvasState.objectOrder.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'local-user',
        };
        setPreviewObject(ellipseObj);
      } else if (activeTool === 'line') {
        const lineObj: LineObject = {
          id: 'preview-line',
          type: 'line',
          x: pointerStartWorldRef.current.x,
          y: pointerStartWorldRef.current.y,
          points: [pointerStartWorldRef.current, worldPoint],
          stroke: selectedColor,
          strokeWidth,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.9,
          zIndex: canvasState.objectOrder.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'local-user',
        };
        setPreviewObject(lineObj);
      } else if (activeTool === 'pencil') {
        activeStrokePointsRef.current.push(worldPoint);
        const strokeObj: StrokeObject = {
          id: 'preview-stroke',
          type: 'stroke',
          x: activeStrokePointsRef.current[0].x,
          y: activeStrokePointsRef.current[0].y,
          points: [...activeStrokePointsRef.current],
          stroke: selectedColor,
          strokeWidth,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          zIndex: canvasState.objectOrder.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'local-user',
        };
        setPreviewObject(strokeObj);
      }
    },
    [viewport, activeTool, selectedObjectId, canvasState, selectedColor, strokeWidth, onUpdateObject],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY, viewport);

      activeResizeHandleRef.current = null;
      initialObjectBoundsRef.current = null;
      initialObjectPosRef.current = null;

      if (activeTool === 'rectangle') {
        const box = normalizeBox(pointerStartWorldRef.current, worldPoint);
        if (box.width > 4 && box.height > 4) {
          const finalRect: RectangleObject = {
            id: generateId('rect'),
            type: 'rectangle',
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            fill: `${selectedColor}22`,
            stroke: selectedColor,
            strokeWidth,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: canvasState.objectOrder.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'local-user',
          };
          onAddObject(finalRect);
          setSelectedObjectId(finalRect.id);
        }
        setPreviewObject(null);
      } else if (activeTool === 'ellipse') {
        const box = normalizeBox(pointerStartWorldRef.current, worldPoint);
        const rx = box.width / 2;
        const ry = box.height / 2;
        if (rx > 3 && ry > 3) {
          const finalEllipse: EllipseObject = {
            id: generateId('ellipse'),
            type: 'ellipse',
            x: box.x + rx,
            y: box.y + ry,
            radiusX: rx,
            radiusY: ry,
            fill: `${selectedColor}22`,
            stroke: selectedColor,
            strokeWidth,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: canvasState.objectOrder.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'local-user',
          };
          onAddObject(finalEllipse);
          setSelectedObjectId(finalEllipse.id);
        }
        setPreviewObject(null);
      } else if (activeTool === 'line') {
        const p1 = pointerStartWorldRef.current;
        const p2 = worldPoint;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (Math.hypot(dx, dy) > 4) {
          const finalLine: LineObject = {
            id: generateId('line'),
            type: 'line',
            x: p1.x,
            y: p1.y,
            points: [p1, p2],
            stroke: selectedColor,
            strokeWidth,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: canvasState.objectOrder.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'local-user',
          };
          onAddObject(finalLine);
          setSelectedObjectId(finalLine.id);
        }
        setPreviewObject(null);
      } else if (activeTool === 'pencil') {
        if (activeStrokePointsRef.current.length >= 2) {
          const finalStroke: StrokeObject = {
            id: generateId('stroke'),
            type: 'stroke',
            x: activeStrokePointsRef.current[0].x,
            y: activeStrokePointsRef.current[0].y,
            points: [...activeStrokePointsRef.current],
            stroke: selectedColor,
            strokeWidth,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: canvasState.objectOrder.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'local-user',
          };
          onAddObject(finalStroke);
          setSelectedObjectId(finalStroke.id);
        }
        activeStrokePointsRef.current = [];
        setPreviewObject(null);
      }
    },
    [viewport, activeTool, selectedColor, strokeWidth, generateId, canvasState.objectOrder.length, onAddObject],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const targetZoom = viewport.zoom * zoomFactor;

      setViewport((prev) => zoomAtScreenPoint(screenX, screenY, prev, targetZoom));
    },
    [viewport.zoom],
  );

  const handleConfirmText = useCallback(
    (text: string) => {
      if (!textInputState) return;
      if (text.trim().length > 0) {
        const textObj: TextObject = {
          id: generateId('text'),
          type: 'text',
          x: textInputState.worldX,
          y: textInputState.worldY,
          text: text.trim(),
          fontSize: 20,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          fill: selectedColor,
          textAlign: 'left',
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          zIndex: canvasState.objectOrder.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'local-user',
        };
        onAddObject(textObj);
        setSelectedObjectId(textObj.id);
      }
      setTextInputState(null);
      setActiveTool('select');
    },
    [textInputState, selectedColor, canvasState.objectOrder.length, generateId, onAddObject],
  );

  const handleCancelText = useCallback(() => {
    setTextInputState(null);
  }, []);

  const handleResetViewport = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  return {
    viewport,
    setViewport,
    activeTool,
    setActiveTool,
    selectedObjectId,
    setSelectedObjectId,
    selectedColor,
    setSelectedColor,
    strokeWidth,
    setStrokeWidth,
    previewObject,
    textInputState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleConfirmText,
    handleCancelText,
    handleResetViewport,
  };
}
