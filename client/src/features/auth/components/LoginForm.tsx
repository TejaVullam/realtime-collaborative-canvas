import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../services/authApi.js';

interface LoginFormProps {
  onNavigateToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onNavigateToRegister,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to log in. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-4 shadow-inner">
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Welcome Back
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Sign in to your collaborative creative workspace
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5"
        >
          <svg
            className="w-5 h-5 shrink-0 mt-0.5 text-rose-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
          >
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Signing in...</span>
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
        <p className="text-sm text-slate-400">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors hover:underline focus:outline-none"
          >
            Create one now
          </button>
        </p>
      </div>
    </div>
  );
};
