import { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './features/auth/context/AuthContext.js';
import { useAuth } from './features/auth/hooks/useAuth.js';
import { LoginForm } from './features/auth/components/LoginForm.js';
import { RegisterForm } from './features/auth/components/RegisterForm.js';
import { Dashboard } from './features/rooms/components/Dashboard.js';
import { Canvas } from './features/canvas/components/Canvas.js';
import { roomApi } from './features/rooms/services/roomApi.js';
import type { Room } from './features/rooms/types/room.js';

function AppContent() {
  const { token, isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(
    window.location.pathname || '/',
  );
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState<boolean>(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Sync navigation with browser history
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle direct access to /rooms/:roomId
  useEffect(() => {
    const match = currentPath.match(/^\/rooms\/([a-zA-Z0-9_-]+)$/);
    if (match && token && (!activeRoom || activeRoom.id !== match[1])) {
      const roomId = match[1];
      setRoomLoading(true);
      setRoomError(null);
      roomApi
        .getRoom(roomId, token)
        .then((room) => {
          setActiveRoom(room);
        })
        .catch((err) => {
          setRoomError(err instanceof Error ? err.message : 'Room access denied');
          setActiveRoom(null);
        })
        .finally(() => {
          setRoomLoading(false);
        });
    }
  }, [currentPath, token, activeRoom]);

  // Loading Splash Screen
  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Initializing Workspace...
        </p>
      </div>
    );
  }

  // Unauthenticated Navigation
  if (!isAuthenticated) {
    if (currentPath === '/register') {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950">
          <RegisterForm onNavigateToLogin={() => navigate('/login')} />
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950">
        <LoginForm onNavigateToRegister={() => navigate('/register')} />
      </div>
    );
  }

  // Authenticated: Route /rooms/:roomId
  const roomMatch = currentPath.match(/^\/rooms\/([a-zA-Z0-9_-]+)$/);
  if (roomMatch) {
    if (roomLoading) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Loading Collaborative Room...
          </p>
        </div>
      );
    }

    if (roomError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Access Restricted</h3>
            <p className="text-xs text-slate-400 mb-5">{roomError}</p>
            <button
              onClick={() => {
                setActiveRoom(null);
                setRoomError(null);
                navigate('/dashboard');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return (
      <main className="w-screen h-screen overflow-hidden bg-slate-950">
        <Canvas
          roomName={activeRoom?.name || 'Collaborative Room'}
          roomId={activeRoom?.id}
          canvasId={activeRoom?.canvasId}
          onBackToDashboard={() => {
            setActiveRoom(null);
            navigate('/dashboard');
          }}
        />
      </main>
    );
  }

  // Authenticated Default: Dashboard (/dashboard or /)
  return (
    <Dashboard
      onEnterRoom={(room) => {
        setActiveRoom(room);
        navigate(`/rooms/${room.id}`);
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
