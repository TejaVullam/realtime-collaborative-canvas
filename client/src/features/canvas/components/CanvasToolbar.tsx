import React from 'react';
import type { CanvasTool } from '../types/interaction.js';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  selectedColor: string;
  onChangeColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
}

interface ToolConfig {
  id: CanvasTool;
  label: string;
  hotkey: string;
  icon: React.ReactNode;
}

const TOOLS: ToolConfig[] = [
  {
    id: 'select',
    label: 'Select & Move',
    hotkey: 'V',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l7 18 3-7 7-3L3 3z" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    hotkey: 'R',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    hotkey: 'O',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line',
    hotkey: 'L',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'pencil',
    label: 'Pencil',
    hotkey: 'P',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    hotkey: 'T',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M12 6v14m-4 0h8" />
      </svg>
    ),
  },
  {
    id: 'pan',
    label: 'Pan Canvas',
    hotkey: 'H',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v6.5m0 0V8a1.5 1.5 0 013 0v4.5" />
      </svg>
    ),
  },
];

const PRESET_COLORS = [
  '#f8fafc',
  '#38bdf8',
  '#4ade80',
  '#facc15',
  '#f43f5e',
  '#a855f7',
];

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeTool,
  onSelectTool,
  selectedColor,
  onChangeColor,
  strokeWidth,
  onChangeStrokeWidth,
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl text-slate-300">
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.label} (${tool.hotkey})`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {tool.icon}
              <span className="hidden sm:inline">{tool.label}</span>
              <kbd className={`text-[10px] px-1 py-0.5 rounded ${isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'}`}>
                {tool.hotkey}
              </kbd>
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-800 mx-1" />

      <div className="flex items-center gap-1 px-1">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChangeColor(color)}
            style={{ backgroundColor: color }}
            className={`w-5 h-5 rounded-full transition-transform ${
              selectedColor === color
                ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900 scale-110'
                : 'opacity-70 hover:opacity-100 hover:scale-105'
            }`}
            title={`Select Color: ${color}`}
          />
        ))}
      </div>

      <div className="h-5 w-px bg-slate-800 mx-1" />

      <div className="flex items-center gap-1 px-1">
        {[2, 4, 8].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChangeStrokeWidth(w)}
            className={`w-6 h-6 flex items-center justify-center rounded text-[11px] font-semibold transition-colors ${
              strokeWidth === w
                ? 'bg-slate-800 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:bg-slate-800/60'
            }`}
            title={`Stroke Width ${w}px`}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
};
