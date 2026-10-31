import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const from         = location.state?.from?.pathname || '/';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      // Redirect based on role
      if (user.role === 'PORTAL') navigate('/portal/subscriptions', { replace: true });
      else navigate(from !== '/' ? from : '/admin/products', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in to Brightloop">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email" required autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Password">
          <input
            type="password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm text-center text-gray-500">
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">Forgot password?</Link>
          {' · '}
          <Link to="/signup" className="text-indigo-600 hover:underline">Create account</Link>
        </p>
      </form>
    </AuthShell>
  );
}

// ── Shared auth-page primitives ────────────────────────────────────────────

export function AuthShell({ title, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold text-indigo-600">Brightloop</span>
          <p className="mt-1 text-sm text-gray-500">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
export const BTN_PRIMARY = 'w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors';
export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
export function ErrorBox({ children }) {
  return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{children}</p>;
}

