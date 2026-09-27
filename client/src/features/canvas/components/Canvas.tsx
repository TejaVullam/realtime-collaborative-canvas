import React, { useRef, useEffect, useState, useReducer } from 'react';
import { renderCanvas } from '../rendering/renderCanvas.js';
import {
  canvasStateReducer,
  createInitialCanvasState,
} from '../state/canvasState.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import { CanvasStatusBar } from './CanvasStatusBar.js';
import { useWebSocket } from '../../realtime/hooks/useWebSocket.js';
import { ConnectionStatusBadge } from '../../realtime/components/ConnectionStatusBadge.js';

import { defaultCollaborationService } from '../../realtime/services/collaborationService.js';
import type {
  CanvasObject,
  CanvasOperation,
  CreateObjectOperation,
  DeleteObjectOperation,
} from '../../../types/canvas.js';

export interface CanvasProps {
  roomName?: string;
  roomId?: string;
  canvasId?: string;
  token?: string | null;
  onBackToDashboard?: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  roomName,
  roomId,
  canvasId,
  token,
  onBackToDashboard,
}) => {
  const { status: wsStatus, error: wsError } = useWebSocket({
    roomId,
    token,
    autoConnect: Boolean(token),
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [inputText, setInputText] = useState('');

  // Stable Client ID for operation attribution
  const clientIdRef = useRef<string>(
    `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  );

  // Local Canvas State Reducer
  const [canvasState, dispatch] = useReducer(
    canvasStateReducer,
    canvasId || 'local-canvas-1',
    createInitialCanvasState,
  );

  // Subscribe to Remote Canvas Operations via CollaborationService
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = defaultCollaborationService.subscribeToCanvasOperations(
      (remoteOp) => {
        dispatch({
          type: 'APPLY_OPERATION',
          source: 'remote',
          operation: remoteOp,
        });
      },
    );

    return () => {
      unsubscribe();
      defaultCollaborationService.clearProcessedOperations();
    };
  }, [roomId]);

  // Throttled operation transmission timers for smooth dragging
  const lastSentTimeRef = useRef<Record<string, number>>({});
  const pendingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup dangling timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(pendingTimersRef.current)) {
        clearTimeout(timer);
      }
      pendingTimersRef.current = {};
    };
  }, []);

  // Local action: Object Creation
  const handleAddObject = (obj: CanvasObject) => {
    const op: CreateObjectOperation = {
      operationId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      canvasId: roomId || canvasId || 'local-canvas-1',
      type: 'CREATE_OBJECT',
      objectId: obj.id,
      timestamp: Date.now(),
      clientId: clientIdRef.current,
      payload: { object: obj },
    };

    // 1. Immediate local application for responsive 60fps UI
    dispatch({ type: 'APPLY_OPERATION', source: 'local', operation: op });
    // 2. Transmit through collaboration service
    defaultCollaborationService.sendCanvasOperation(op);
  };

  // Local action: Object Update / Move
  const handleUpdateObject = (id: string, patch: Partial<CanvasObject>) => {
    const keys = Object.keys(patch);
    const isPureMove =
      keys.length > 0 &&
      keys.every((k) => k === 'x' || k === 'y') &&
      typeof patch.x === 'number' &&
      typeof patch.y === 'number';

    const op: CanvasOperation = isPureMove
      ? {
          operationId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          canvasId: roomId || canvasId || 'local-canvas-1',
          type: 'MOVE_OBJECT',
          objectId: id,
          timestamp: Date.now(),
          clientId: clientIdRef.current,
          payload: { x: patch.x!, y: patch.y! },
        }
      : {
          operationId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          canvasId: roomId || canvasId || 'local-canvas-1',
          type: 'UPDATE_OBJECT',
          objectId: id,
          timestamp: Date.now(),
          clientId: clientIdRef.current,
          payload: { patch },
        };

    // 1. Immediate local application
    dispatch({ type: 'APPLY_OPERATION', source: 'local', operation: op });

    // 2. Throttled remote broadcast for mouse movements (40ms / 25fps) with guaranteed trailing delivery
    const now = Date.now();
    const lastSent = lastSentTimeRef.current[id] || 0;
    const THROTTLE_MS = 40;

    if (pendingTimersRef.current[id]) {
      clearTimeout(pendingTimersRef.current[id]);
      delete pendingTimersRef.current[id];
    }

    if (now - lastSent >= THROTTLE_MS) {
      lastSentTimeRef.current[id] = now;
      defaultCollaborationService.sendCanvasOperation(op);
    } else {
      pendingTimersRef.current[id] = setTimeout(() => {
        lastSentTimeRef.current[id] = Date.now();
        defaultCollaborationService.sendCanvasOperation(op);
        delete pendingTimersRef.current[id];
      }, THROTTLE_MS - (now - lastSent));
    }
  };

  // Local action: Object Deletion
  const handleDeleteObject = (id: string) => {
    const op: DeleteObjectOperation = {
      operationId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      canvasId: roomId || canvasId || 'local-canvas-1',
      type: 'DELETE_OBJECT',
      objectId: id,
      timestamp: Date.now(),
      clientId: clientIdRef.current,
      payload: { objectId: id },
    };

    dispatch({ type: 'APPLY_OPERATION', source: 'local', operation: op });
    defaultCollaborationService.sendCanvasOperation(op);
  };

  // Canvas Interactions Hook
  const {
    viewport,
    activeTool,
    setActiveTool,
    selectedObjectId,
    selectedColor,
    setSelectedColor,
    strokeWidth,
    setStrokeWidth,
    previewObject,
    textInputState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWheel,
    handleConfirmText,
    handleCancelText,
    handleResetViewport,
  } = useCanvasInteraction({
    canvasState,
    onAddObject: handleAddObject,
    onUpdateObject: handleUpdateObject,
    onDeleteObject: handleDeleteObject,
  });

  // Responsive Container Sizing with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // HTML5 Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Set physical resolution
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;

    // Set CSS display dimensions
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    // Execute render pipeline
    renderCanvas({
      ctx,
      canvasState,
      viewport,
      selectedObjectId,
      previewObject,
      width: dimensions.width,
      height: dimensions.height,
      dpr,
    });
  }, [canvasState, viewport, selectedObjectId, previewObject, dimensions]);

  // Dynamic Cursor
  const getCursorStyle = () => {
    if (activeTool === 'pan') return 'grab';
    if (activeTool === 'select') return 'default';
    if (activeTool === 'text') return 'text';
    return 'crosshair';
  };

  const selectedObject = selectedObjectId
    ? canvasState.objects[selectedObjectId] || null
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-screen bg-slate-950 overflow-hidden select-none"
    >
      {/* Top Left Room Context Header */}
      {(roomName || onBackToDashboard) && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 backdrop-blur-md text-xs font-medium transition-colors shadow-lg"
              title="Return to Dashboard"
            >
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Dashboard</span>
            </button>
          )}

          {roomName && (
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md text-xs flex items-center gap-2 shadow-lg">
              <span className="font-semibold text-white tracking-wide">
                {roomName}
              </span>
              {roomId && (
                <span className="text-slate-500 font-mono text-[11px] border-l border-slate-800 pl-2">
                  ID: {roomId.slice(-6)}
                </span>
              )}
            </div>
          )}

          {roomId && (
            <ConnectionStatusBadge status={wsStatus} error={wsError} />
          )}
        </div>
      )}

      {/* Top Floating Toolbar */}
      <CanvasToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedColor={selectedColor}
        onChangeColor={setSelectedColor}
        strokeWidth={strokeWidth}
        onChangeStrokeWidth={setStrokeWidth}
      />

      {/* Main HTML5 Canvas Element */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onWheel={handleWheel}
        style={{ cursor: getCursorStyle(), touchAction: 'none' }}
        className="block w-full h-full"
      />

      {/* Empty State Banner */}
      {canvasState.objectOrder.length === 0 && !previewObject && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-center p-6 rounded-2xl bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 shadow-2xl max-w-sm mx-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Canvas Ready
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select a tool from the toolbar above to start creating rectangles, ellipses, lines, strokes, and text.
            </p>
          </div>
        </div>
      )}

      {/* Inline Text Creation Modal */}
      {textInputState?.isOpen && (
        <div
          className="absolute z-30 p-3 bg-slate-900/95 border border-blue-500/50 rounded-xl shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(textInputState.screenX, dimensions.width - 260),
            top: Math.min(textInputState.screenY, dimensions.height - 120),
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmText(inputText);
              setInputText('');
            }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Enter text..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-56 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  handleCancelText();
                  setInputText('');
                }}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded shadow"
              >
                Add Text
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom Status Bar */}
      <CanvasStatusBar
        viewport={viewport}
        objectCount={canvasState.objectOrder.length}
        selectedObject={selectedObject}
        activeTool={activeTool}
        onResetViewport={handleResetViewport}
      />
    </div>
  );
};
