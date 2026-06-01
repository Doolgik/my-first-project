import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { apiErrorMessage } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(emailOrUsername, password);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in glass-card rounded-[1.75rem] p-7">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-3xl shadow-lg shadow-brand-600/40">
            💬
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to Pulse Messenger</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            placeholder="Email or username"
            value={emailOrUsername}
            autoCapitalize="none"
            autoComplete="username"
            onChange={(e) => setEmailOrUsername(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-400 hover:text-brand-300">
            Create an account
          </Link>
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center text-xs text-slate-500">
          Demo: <span className="text-slate-300">alice@example.com</span> / <span className="text-slate-300">password123</span>
        </div>
      </div>
    </div>
  );
}
