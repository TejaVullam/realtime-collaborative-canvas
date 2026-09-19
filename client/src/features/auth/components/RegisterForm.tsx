import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../services/authApi.js';

interface RegisterFormProps {
  onNavigateToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onNavigateToLogin,
}) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-4 shadow-inner">
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
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Create an Account
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Join the collaborative digital canvas workspace
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="register-name"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Full Name
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Teja Vullam"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="register-email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Email Address
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="register-password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            placeholder="At least 6 characters"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="register-confirm-password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Confirm Password
          </label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            placeholder="Repeat your password"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <span>Creating Account...</span>
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors hover:underline focus:outline-none"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
