import React, { useRef, useEffect, useState, useReducer } from 'react';
import { renderCanvas } from '../rendering/renderCanvas.js';
import {
  canvasStateReducer,
  createInitialCanvasState,
} from '../state/canvasState.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import { CanvasStatusBar } from './CanvasStatusBar.js';

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [inputText, setInputText] = useState('');

  // Local Canvas State Reducer
  const [canvasState, dispatch] = useReducer(
    canvasStateReducer,
    undefined,
    createInitialCanvasState,
  );

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
    handleWheel,
    handleConfirmText,
    handleCancelText,
    handleResetViewport,
  } = useCanvasInteraction({
    canvasState,
    onAddObject: (obj) => dispatch({ type: 'ADD_OBJECT', payload: obj }),
    onUpdateObject: (id, patch) =>
      dispatch({ type: 'UPDATE_OBJECT', payload: { id, patch } }),
    onDeleteObject: (id) => dispatch({ type: 'DELETE_OBJECT', payload: { id } }),
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
