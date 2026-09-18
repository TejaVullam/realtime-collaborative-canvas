import React from 'react';
import type { CanvasTool, CanvasViewport } from '../types/interaction.js';
import type { CanvasObject } from '../../../types/canvas.js';

interface CanvasStatusBarProps {
  viewport: CanvasViewport;
  objectCount: number;
  selectedObject: CanvasObject | null;
  activeTool: CanvasTool;
  onResetViewport: () => void;
}

export const CanvasStatusBar: React.FC<CanvasStatusBarProps> = ({
  viewport,
  objectCount,
  selectedObject,
  activeTool,
  onResetViewport,
}) => {
  const zoomPercent = Math.round(viewport.zoom * 100);

  return (
    <footer className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none text-xs text-slate-400">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg shadow pointer-events-auto">
        <button
          type="button"
          onClick={onResetViewport}
          className="font-medium text-slate-300 hover:text-white hover:underline transition-colors"
          title="Click to reset zoom (100%)"
        >
          Zoom: {zoomPercent}%
        </button>
        <span className="text-slate-700">|</span>
        <span>
          Objects: <strong className="text-slate-200">{objectCount}</strong>
        </span>
        {selectedObject && (
          <>
            <span className="text-slate-700">|</span>
            <span className="text-blue-400 font-medium">
              Selected: {selectedObject.type} ({selectedObject.id.slice(0, 8)})
            </span>
          </>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg shadow pointer-events-auto">
        <span className="text-slate-400">
          Tool: <span className="capitalize text-slate-200">{activeTool}</span>
        </span>
        <span className="text-slate-700">|</span>
        <span className="text-slate-500">
          Hold <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Space</kbd> or Middle-click to pan
        </span>
        <span className="text-slate-700">|</span>
        <span className="text-slate-500">
          <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Del</kbd> to delete
        </span>
      </div>
    </footer>
  );
};
