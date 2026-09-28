import React from 'react';
import type { ConnectionStatus, SyncStatus } from '../types/websocket.js';

export interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  syncStatus?: SyncStatus;
  error?: string | null;
  className?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  syncStatus = 'synced',
  error,
  className = '',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        if (syncStatus === 'syncing') {
          return {
            dotColor: 'bg-cyan-400',
            ping: true,
            textColor: 'text-cyan-300',
            label: 'Syncing...',
          };
        }
        if (syncStatus === 'diverged') {
          return {
            dotColor: 'bg-amber-400',
            ping: false,
            textColor: 'text-amber-300',
            label: 'Resyncing...',
          };
        }
        return {
          dotColor: 'bg-emerald-400',
          ping: true,
          textColor: 'text-emerald-300',
          label: 'Synced',
        };
      case 'connecting':
        return {
          dotColor: 'bg-amber-400',
          ping: false,
          textColor: 'text-amber-300',
          label: 'Connecting...',
        };
      case 'reconnecting':
        return {
          dotColor: 'bg-orange-400',
          ping: false,
          textColor: 'text-orange-300',
          label: 'Reconnecting...',
        };
      case 'error':
        return {
          dotColor: 'bg-rose-400',
          ping: false,
          textColor: 'text-rose-300',
          label: error ? `Error: ${error}` : 'Connection Error',
        };
      case 'disconnected':
      default:
        return {
          dotColor: 'bg-slate-400',
          ping: false,
          textColor: 'text-slate-400',
          label: 'Disconnected',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-medium backdrop-blur-md shadow-sm transition-colors ${className}`}
      title={error || `Status: ${status}`}
    >
      <span className="relative flex h-2 w-2">
        {config.ping && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`}
        />
      </span>
      <span className={config.textColor}>{config.label}</span>
    </div>
  );
};
