import React, { useState, useEffect, useCallback } from 'react';
import type { Room } from '../types/room.js';
import { roomApi, RoomApiError } from '../services/roomApi.js';
import { useAuth } from '../../auth/hooks/useAuth.js';

interface DashboardProps {
  onEnterRoom: (room: Room) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onEnterRoom }) => {
  const { user, token, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await roomApi.getRooms(token);
      setRooms(data);
    } catch (err) {
      if (err instanceof RoomApiError) {
        setError(err.message);
      } else {
        setError('Failed to load collaborative rooms.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newRoomName.trim()) return;

    setModalSubmitting(true);
    setModalError(null);
    try {
      const room = await roomApi.createRoom(newRoomName.trim(), token);
      setRooms((prev) => [room, ...prev]);
      setNewRoomName('');
      setIsCreateModalOpen(false);
      onEnterRoom(room);
    } catch (err) {
      if (err instanceof RoomApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to create room.');
      }
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !joinRoomId.trim()) return;

    setModalSubmitting(true);
    setModalError(null);
    try {
      const room = await roomApi.joinRoom(joinRoomId.trim(), token);
      // Update room list
      setRooms((prev) => {
        const exists = prev.some((r) => r.id === room.id);
        return exists ? prev : [room, ...prev];
      });
      setJoinRoomId('');
      setIsJoinModalOpen(false);
      onEnterRoom(room);
    } catch (err) {
      if (err instanceof RoomApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to join room. Verify room ID format.');
      }
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleLeaveRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm('Are you sure you want to leave this room?')) return;

    try {
      await roomApi.leaveRoom(roomId, token);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to leave room');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">
              Collaborative Workspace
            </h1>
            <p className="text-xs text-slate-400">Real-Time Canvas Foundation</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-200">{user?.name}</span>
            <span className="text-slate-400 hidden sm:inline">({user?.email})</span>
          </div>

          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        {/* Workspace Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800/80">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Your Creative Rooms
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Select an existing room to resume work, or initialize a new collaborative session.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setModalError(null);
                setIsJoinModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
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
                  d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Join via ID</span>
            </button>

            <button
              onClick={() => {
                setModalError(null);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Create New Room</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchRooms}
              className="text-xs underline hover:text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Rooms Grid / States */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-5 bg-slate-800 rounded w-2/3" />
                  <div className="h-3 bg-slate-800/60 rounded w-1/3" />
                </div>
                <div className="h-8 bg-slate-800/40 rounded w-full" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-200">
              No rooms found
            </h3>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by creating your first collaborative room or enter an ID to join a teammate's canvas.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow"
              >
                Create Room
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const isOwner = room.ownerId === user?.id;
              return (
                <div
                  key={room.id}
                  onClick={() => onEnterRoom(room)}
                  className="group relative cursor-pointer p-6 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          isOwner
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {isOwner ? 'Owner' : 'Member'}
                      </span>

                      <span className="text-[11px] text-slate-500 font-mono">
                        ID: {room.id.slice(-6)}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                      {room.name}
                    </h3>

                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <svg
                        className="w-3.5 h-3.5 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span>
                        {room.members.length}{' '}
                        {room.members.length === 1 ? 'member' : 'members'}
                      </span>
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 flex items-center gap-1"
                    >
                      <span>Open Canvas</span>
                      <svg
                        className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    {!isOwner && (
                      <button
                        onClick={(e) => handleLeaveRoom(room.id, e)}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-2 py-1"
                        title="Leave Room"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Create Room */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create New Room</h3>
            <p className="text-xs text-slate-400 mb-5">
              Give your collaborative canvas workspace a clear, recognizable name.
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateRoom}>
              <div className="mb-5">
                <label
                  htmlFor="room-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                >
                  Room Title
                </label>
                <input
                  id="room-name"
                  type="text"
                  autoFocus
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Design System Sprint"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={modalSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !newRoomName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow disabled:opacity-50"
                >
                  {modalSubmitting ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Room */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Join a Room</h3>
            <p className="text-xs text-slate-400 mb-5">
              Paste the Room ID provided by the session creator to join their canvas.
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleJoinRoom}>
              <div className="mb-5">
                <label
                  htmlFor="room-id"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                >
                  Room ID
                </label>
                <input
                  id="room-id"
                  type="text"
                  autoFocus
                  required
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="e.g. 65f0a1b2c3d4e5f678901234"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  disabled={modalSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !joinRoomId.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow disabled:opacity-50"
                >
                  {modalSubmitting ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
