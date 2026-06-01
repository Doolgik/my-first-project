import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { apiErrorMessage } from '../lib/api';

export default function Register() {
  const navigate = useNavigate();
  const register = useAuth((s) => s.register);
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm animate-fade-in glass-card rounded-[1.75rem] p-7">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-3xl shadow-lg shadow-brand-600/40">
            💬
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Join Pulse Messenger</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Display name" value={form.displayName} onChange={update('displayName')} required />
          <input
            className="input"
            placeholder="Username"
            value={form.username}
            autoCapitalize="none"
            onChange={update('username')}
            required
          />
          <input className="input" type="email" placeholder="Email" value={form.email} autoCapitalize="none" onChange={update('email')} required />
          <input
            className="input"
            type="password"
            placeholder="Password (min 8 characters)"
            value={form.password}
            onChange={update('password')}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-400 hover:text-brand-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
